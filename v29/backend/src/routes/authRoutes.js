import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { query } from "../data/index.js";
import { authenticateToken } from "../middleware_auth.js";
import rateLimit from "express-rate-limit";
import QRCode from "qrcode";
import { authenticator } from "otplib";
import {
  decryptTwoFactorSecret,
  encryptTwoFactorSecret,
  generateRecoveryCodes,
  hashRecoveryCode,
} from "../utils/twoFactorCrypto.js";
import {
  addLoginAttemptRepo,
  addSecurityEventRepo,
  addAuditLogRepo,
  createSecuritySessionRepo,
} from "../data/securityRepository.js";
import { createNotificationRepo } from "../data/leaveNotificationRepository.js";
import { readSecurityPolicy, roleRequiresTwoFactor } from "../utils/securityPolicy.js";

const router = Router();
const jwtSecret = () => process.env.JWT_SECRET || "dev-secret";
authenticator.options = { window: 1 };
const twoFactorLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { message: "Too many verification attempts. Please try again later." },
});

function getClientIp(req) {
  const value = String(req.ip || req.socket?.remoteAddress || "-").trim();
  return value.replace(/^::ffff:/, "") || "-";
}

async function notifySystemOwnersOfLogin(req, user) {
  try {
    const owners = await query(
      `SELECT DISTINCT u.id FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE COALESCE(u.is_active, TRUE) = TRUE
         AND LOWER(COALESCE(r.code, r.name, '')) IN
           ('owner', 'system_owner', 'system owner', 'systemowner')`
    );
    const ipAddress = getClientIp(req);
    const displayName = user.full_name || user.name || user.username;
    const loggedInAt = new Date().toISOString();
    await Promise.allSettled(owners.rows.map((owner) => createNotificationRepo(
      owner.id,
      `تسجيل دخول جديد / New login: ${displayName} (${user.username}) · IP: ${ipAddress}`,
      "security_login",
      "/security",
      {
        username: user.username,
        userId: user.id,
        ipAddress,
        userAgent: req.get("user-agent") || "-",
        loggedInAt,
      }
    )));
  } catch (error) {
    console.error("Login owner notification error:", error.message);
  }
}

function sessionUserFromRow(user) {
  const roleName = user.role_name || "Employee";
  return {
    id: user.id,
    username: user.username,
    name: user.full_name || user.name || user.username,
    email: user.email || null,
    role: roleName,
    roleName,
    roleId: user.role_id || null,
    employeeId: user.employee_id || null,
    gasId: user.gas_id || null,
    division: user.division || null,
    jobTitle: user.job_title || null,
    projectId: user.project_id || null,
    packageId: user.package_id || null,
    projectName: user.project_name || user.employee_project_name || null,
    packageName: user.package_name || user.employee_package_name || null,
    supervisorId: user.supervisor_id || null,
    accessScope: user.access_scope || null,
    status: user.status || null,
    permissions: Array.isArray(user.permissions) ? user.permissions : [],
    nationalityType: user.nationality_type || null,
    twoFactorEnabled: Boolean(user.two_factor_enabled),
    allowDuringMaintenance: Boolean(user.allow_during_maintenance),
  };
}

function createSessionToken(sessionUser, sessionId = null, sessionHours = 12) {
  const hours = Math.min(168, Math.max(1, Number(sessionHours) || 12));
  return jwt.sign({ ...sessionUser, sessionId }, jwtSecret(), { expiresIn: `${hours}h` });
}

function createSecurityActionToken(sessionUser, action) {
  return jwt.sign({ ...sessionUser, securityActionOnly: action }, jwtSecret(), { expiresIn: "15m" });
}

async function recordLoginAttempt(req, username, status) {
  try {
    await addLoginAttemptRepo({
      username: String(username || "unknown").trim(),
      ipAddress: getClientIp(req),
      userAgent: req.get("user-agent") || "-",
      status,
    });
  } catch (error) {
    console.error("Login audit error:", error.message);
  }
}

async function createTrackedSession(req, userId, sessionHours = 12) {
  try {
    return await createSecuritySessionRepo(
      userId,
      getClientIp(req),
      req.get("user-agent") || "-",
      sessionHours
    );
  } catch (error) {
    console.error("Session tracking error:", error.message);
    return null;
  }
}

async function recordFailedCredential(req, user, policy) {
  const attempts = Number(user?.failed_attempts || 0) + 1;
  const maxAttempts = Math.min(20, Math.max(3, Number(policy?.maxFailedAttempts) || 5));
  const lockMinutes = Math.min(1440, Math.max(1, Number(policy?.lockMinutes) || 15));
  const locked = attempts >= maxAttempts;
  await query(
    `UPDATE users SET failed_attempts = $2, last_login_ip = $3,
       status = CASE WHEN $4 THEN 'locked' ELSE status END,
       is_locked = CASE WHEN $4 THEN TRUE ELSE is_locked END,
       locked_until = CASE WHEN $4 THEN NOW() + make_interval(mins => $5::int) ELSE locked_until END,
       updated_at = NOW() WHERE id = $1`,
    [user.id, attempts, getClientIp(req), locked, lockMinutes]
  );
  await recordLoginAttempt(req, user.username, locked ? "locked" : "failed");
  if (locked) {
    await addSecurityEventRepo("account_locked", user.id, { attempts }, getClientIp(req)).catch(() => {});
  }
  return locked;
}

function verifySecondFactor(user, submittedCode) {
  const code = String(submittedCode || "").replace(/[\s-]/g, "").toUpperCase();
  if (!code || !user.two_factor_secret) return { valid: false };
  const secret = decryptTwoFactorSecret(user.two_factor_secret);
  if (/^\d{6}$/.test(code) && authenticator.verify({ token: code, secret })) {
    return { valid: true, recoveryIndex: -1 };
  }
  const recoveryCodes = Array.isArray(user.two_factor_recovery_codes)
    ? user.two_factor_recovery_codes
    : [];
  const recoveryIndex = recoveryCodes.indexOf(hashRecoveryCode(code));
  return { valid: recoveryIndex >= 0, recoveryIndex };
}

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({
        message: "Username and password are required",
      });
    }
    const securityPolicy = await readSecurityPolicy();

    const userResult = await query(
      `
      SELECT
        u.id,
        u.username,
        u.email,
        u.password_hash,
        u.full_name,
        u.name,
        u.role_id,
        u.employee_id,
        u.is_active,
        u.gas_id,
        u.division,
        u.job_title,
        u.project_id,
        u.package_id,
        u.supervisor_id,
        u.access_scope,
        u.status,
        u.permissions,
        u.allow_during_maintenance,
        u.failed_attempts,
        u.is_locked,
        u.locked_until,
        u.must_change_password,
        u.last_login_at,
        u.last_login_ip,
        u.nationality_type,
        u.two_factor_enabled,
        u.two_factor_secret,
        r.name AS role_name,
        r.code AS role_code,
        p.name AS project_name,
        pk.name AS package_name,
        e.project_name AS employee_project_name,
        e.package_name AS employee_package_name
      FROM users u
      LEFT JOIN roles r ON r.id = u.role_id
      LEFT JOIN projects p ON p.id = u.project_id
      LEFT JOIN packages pk ON pk.id = u.package_id
      LEFT JOIN employees e ON e.id = u.employee_id
      WHERE u.username = $1
      LIMIT 1
      `,
      [String(username).trim()]
    );

    const user = userResult.rows[0];

    if (!user) {
      await recordLoginAttempt(req, username, "failed");
      return res.status(401).json({
        message: "Invalid username or password",
      });
    }

    if (user.is_active === false) {
      await recordLoginAttempt(req, username, "blocked");
      return res.status(403).json({
        message: "User is inactive",
      });
    }

    if (user.locked_until && new Date(user.locked_until) <= new Date()) {
      await query(
        `UPDATE users SET status = 'active', is_locked = FALSE, failed_attempts = 0,
         locked_until = NULL, updated_at = NOW() WHERE id = $1`,
        [user.id]
      );
      user.status = "active"; user.is_locked = false; user.failed_attempts = 0; user.locked_until = null;
    }

    if (user.status === "locked" || user.is_locked === true ||
        (user.locked_until && new Date(user.locked_until) > new Date())) {
      await recordLoginAttempt(req, username, "locked");
      return res.status(423).json({ message: "Account is temporarily locked. Try again later." });
    }

    if (!user.password_hash) {
      return res.status(500).json({
        message: "User password is not configured",
      });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);

    if (!isValid) {
      const locked = await recordFailedCredential(req, user, securityPolicy);
      return res.status(401).json({
        message: locked ? "Account locked after repeated failed attempts" : "Invalid username or password",
      });
    }

    const displayName = user.full_name || user.name || user.username;
    const roleName = user.role_name || "Employee";
    const permissions = Array.isArray(user.permissions) ? user.permissions : [];

    const resolvedProjectName =
      user.project_name ||
      user.employee_project_name ||
      null;

    const resolvedPackageName =
      user.package_name ||
      user.employee_package_name ||
      null;

    const sessionUser = sessionUserFromRow(user);
    sessionUser.securityPolicy = { inactivityMinutes: securityPolicy.inactivityMinutes };

    if (user.must_change_password) {
      return res.json({
        requiresPasswordChange: true,
        actionToken: createSecurityActionToken(sessionUser, "password_change"),
        passwordMinLength: securityPolicy.passwordMinLength,
      });
    }

    if (!user.two_factor_enabled && roleRequiresTwoFactor(securityPolicy, user)) {
      return res.json({
        requiresTwoFactorSetup: true,
        actionToken: createSecurityActionToken(sessionUser, "two_factor_setup"),
      });
    }

    if (user.two_factor_enabled) {
      const challengeToken = jwt.sign(
        { sub: user.id, purpose: "two-factor-login" },
        jwtSecret(),
        { expiresIn: "5m" }
      );
      return res.json({
        requiresTwoFactor: true,
        challengeToken,
        expiresInSeconds: 300,
      });
    }

    const sessionId = await createTrackedSession(req, user.id, securityPolicy.sessionHours);
    const token = createSessionToken(sessionUser, sessionId, securityPolicy.sessionHours);

    await query(
      `
      UPDATE users
      SET
        last_login_at = NOW(),
        last_login_ip = $2,
        failed_attempts = 0,
        updated_at = NOW()
      WHERE id = $1
      `,
      [user.id, getClientIp(req)]
    );
    await recordLoginAttempt(req, user.username, "success");
    await notifySystemOwnersOfLogin(req, user);

    return res.json({
      token,
      user: sessionUser,
    });
  } catch (error) {
    console.error("Login route error:", error);
    return res.status(500).json({
      message: "Login failed",
    });
  }
});

router.post("/2fa/verify-login", twoFactorLimiter, async (req, res) => {
  try {
    const securityPolicy = await readSecurityPolicy();
    const { challengeToken, code } = req.body || {};
    if (!challengeToken || !code) {
      return res.status(400).json({ message: "Challenge token and verification code are required" });
    }

    let challenge;
    try {
      challenge = jwt.verify(challengeToken, jwtSecret());
    } catch {
      return res.status(401).json({ message: "Verification session expired. Please sign in again." });
    }
    if (challenge.purpose !== "two-factor-login" || !challenge.sub) {
      return res.status(401).json({ message: "Invalid verification session" });
    }

    const result = await query(
      `
      SELECT u.*, r.name AS role_name, r.code AS role_code, p.name AS project_name, pk.name AS package_name,
             e.project_name AS employee_project_name, e.package_name AS employee_package_name
      FROM users u
      LEFT JOIN roles r ON r.id = u.role_id
      LEFT JOIN projects p ON p.id = u.project_id
      LEFT JOIN packages pk ON pk.id = u.package_id
      LEFT JOIN employees e ON e.id = u.employee_id
      WHERE u.id = $1 AND u.is_active = TRUE AND u.two_factor_enabled = TRUE
      LIMIT 1
      `,
      [challenge.sub]
    );
    const user = result.rows[0];
    if (!user) return res.status(401).json({ message: "User or two-factor configuration is unavailable" });
    if (user.status === "locked" || user.is_locked === true ||
        (user.locked_until && new Date(user.locked_until) > new Date())) {
      return res.status(423).json({ message: "Account is temporarily locked. Sign in again later." });
    }

    const verification = verifySecondFactor(user, code);
    if (!verification.valid) {
      const locked = await recordFailedCredential(req, user, securityPolicy);
      return res.status(401).json({ message: locked ? "Account locked after repeated failed attempts" : "Invalid verification code" });
    }

    if (verification.recoveryIndex >= 0) {
      const codes = [...user.two_factor_recovery_codes];
      codes.splice(verification.recoveryIndex, 1);
      await query(
        `UPDATE users SET two_factor_recovery_codes = $2::jsonb, updated_at = NOW() WHERE id = $1`,
        [user.id, JSON.stringify(codes)]
      );
    }

    const sessionUser = sessionUserFromRow(user);
    sessionUser.securityPolicy = { inactivityMinutes: securityPolicy.inactivityMinutes };
    const sessionId = await createTrackedSession(req, user.id, securityPolicy.sessionHours);
    const token = createSessionToken(sessionUser, sessionId, securityPolicy.sessionHours);
    await query(
      `UPDATE users SET last_login_at = NOW(), last_login_ip = $2, failed_attempts = 0, updated_at = NOW() WHERE id = $1`,
      [user.id, getClientIp(req)]
    );
    await recordLoginAttempt(req, user.username, "success");
    await addSecurityEventRepo("two_factor_login", user.id, {}, getClientIp(req)).catch(() => {});
    await notifySystemOwnersOfLogin(req, user);
    return res.json({ token, user: sessionUser });
  } catch (error) {
    console.error("Two-factor login verification error:", error);
    return res.status(500).json({ message: "Failed to verify two-factor code" });
  }
});

router.post("/change-required-password", authenticateToken, async (req, res) => {
  try {
    if (req.user?.securityActionOnly !== "password_change") {
      return res.status(403).json({ message: "Password change session is required" });
    }
    const policy = await readSecurityPolicy();
    const newPassword = String(req.body?.newPassword || "");
    if (newPassword.length < policy.passwordMinLength) {
      return res.status(400).json({
        message: `Password must be at least ${policy.passwordMinLength} characters`,
      });
    }
    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) ||
        !/\d/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) {
      return res.status(400).json({
        message: "Password must include uppercase, lowercase, number and special character",
      });
    }
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await query(
      `UPDATE users SET password_hash = $2, must_change_password = FALSE,
       failed_attempts = 0, updated_at = NOW() WHERE id = $1`,
      [req.user.id, passwordHash]
    );
    await Promise.allSettled([
      addAuditLogRepo("required_password_changed", req.user.name || req.user.username, { userId: req.user.id }),
      addSecurityEventRepo("required_password_changed", req.user.id, {}, getClientIp(req)),
    ]);
    return res.json({ message: "Password changed successfully. Sign in again." });
  } catch (error) {
    console.error("Required password change error:", error);
    return res.status(500).json({ message: "Failed to change password" });
  }
});

router.get("/2fa/status", authenticateToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT two_factor_enabled, two_factor_enabled_at,
              jsonb_array_length(COALESCE(two_factor_recovery_codes, '[]'::jsonb)) AS recovery_codes_remaining
       FROM users WHERE id = $1`,
      [req.user.id]
    );
    const row = result.rows[0] || {};
    return res.json({
      enabled: Boolean(row.two_factor_enabled),
      enabledAt: row.two_factor_enabled_at || null,
      recoveryCodesRemaining: Number(row.recovery_codes_remaining || 0),
    });
  } catch (error) {
    console.error("Two-factor status error:", error);
    return res.status(500).json({ message: "Failed to load two-factor status" });
  }
});

router.post("/2fa/setup", authenticateToken, async (req, res) => {
  try {
    const current = await query(`SELECT username, email, two_factor_enabled FROM users WHERE id = $1`, [req.user.id]);
    const user = current.rows[0];
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.two_factor_enabled) return res.status(409).json({ message: "Two-factor authentication is already enabled" });

    const secret = authenticator.generateSecret();
    const accountName = user.email || user.username;
    const otpauth = authenticator.keyuri(accountName, "GAS HR Portal", secret);
    const qrCodeDataUrl = await QRCode.toDataURL(otpauth, { width: 280, margin: 1 });
    await query(
      `UPDATE users SET two_factor_secret = $2, two_factor_recovery_codes = '[]'::jsonb, updated_at = NOW() WHERE id = $1`,
      [req.user.id, encryptTwoFactorSecret(secret)]
    );
    return res.json({ qrCodeDataUrl, manualKey: secret, accountName });
  } catch (error) {
    console.error("Two-factor setup error:", error);
    return res.status(500).json({ message: "Failed to start two-factor setup" });
  }
});

router.post("/2fa/enable", authenticateToken, twoFactorLimiter, async (req, res) => {
  try {
    const result = await query(
      `SELECT two_factor_enabled, two_factor_secret, two_factor_recovery_codes FROM users WHERE id = $1`,
      [req.user.id]
    );
    const user = result.rows[0];
    if (!user?.two_factor_secret) return res.status(400).json({ message: "Start two-factor setup first" });
    if (user.two_factor_enabled) return res.status(409).json({ message: "Two-factor authentication is already enabled" });
    if (!verifySecondFactor(user, req.body?.code).valid) {
      return res.status(401).json({ message: "Invalid verification code" });
    }

    const recoveryCodes = generateRecoveryCodes();
    const recoveryHashes = recoveryCodes.map(hashRecoveryCode);
    await query(
      `UPDATE users SET two_factor_enabled = TRUE, two_factor_enabled_at = NOW(),
              two_factor_recovery_codes = $2::jsonb, updated_at = NOW() WHERE id = $1`,
      [req.user.id, JSON.stringify(recoveryHashes)]
    );
    await addSecurityEventRepo("two_factor_enabled", req.user.id, {}, getClientIp(req)).catch(() => {});
    return res.json({ enabled: true, recoveryCodes });
  } catch (error) {
    console.error("Two-factor enable error:", error);
    return res.status(500).json({ message: "Failed to enable two-factor authentication" });
  }
});

router.post("/2fa/disable", authenticateToken, twoFactorLimiter, async (req, res) => {
  try {
    const result = await query(
      `SELECT u.two_factor_enabled, u.two_factor_secret, u.two_factor_recovery_codes,
              r.name AS role_name, r.code AS role_code
       FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id = $1`,
      [req.user.id]
    );
    const user = result.rows[0];
    if (!user?.two_factor_enabled) return res.status(400).json({ message: "Two-factor authentication is not enabled" });
    if (roleRequiresTwoFactor(await readSecurityPolicy(), user)) {
      return res.status(403).json({ message: "Two-factor authentication is required for your role" });
    }
    if (!verifySecondFactor(user, req.body?.code).valid) {
      return res.status(401).json({ message: "Invalid verification code" });
    }
    await query(
      `UPDATE users SET two_factor_enabled = FALSE, two_factor_secret = NULL,
              two_factor_recovery_codes = '[]'::jsonb, two_factor_enabled_at = NULL, updated_at = NOW()
       WHERE id = $1`,
      [req.user.id]
    );
    await addSecurityEventRepo("two_factor_disabled", req.user.id, {}, getClientIp(req)).catch(() => {});
    return res.json({ enabled: false });
  } catch (error) {
    console.error("Two-factor disable error:", error);
    return res.status(500).json({ message: "Failed to disable two-factor authentication" });
  }
});

router.get("/session", authenticateToken, (req, res) => {
  return res.status(200).json({ user: req.user });
});

router.post("/logout", authenticateToken, async (req, res) => {
  try {
    if (req.user?.sessionId) {
      await query(
        `UPDATE security_sessions SET revoked_at = NOW(), revoked_by = $2
         WHERE id = $1 AND revoked_at IS NULL`,
        [req.user.sessionId, req.user.id]
      );
    }
    return res.json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    return res.status(500).json({ message: "Failed to close session" });
  }
});
router.post("/fcm-token", authenticateToken, async (req, res) => {
  try {
    const { token } = req.body || {};
    const userId = req.user?.id;

    if (!userId || !token) {
      return res.status(400).json({
        message: "Authenticated user and token are required",
      });
    }

    await query(
      `
      INSERT INTO user_fcm_tokens (user_id, token)
      VALUES ($1, $2)
      ON CONFLICT (user_id, token)
      DO NOTHING
      `,
      [userId, token]
    );

    return res.json({
      message: "FCM token saved",
    });
  } catch (error) {
    console.error("Save FCM token error:", error);
    return res.status(500).json({
      message: "Failed to save token",
    });
  }
});

export default router;
