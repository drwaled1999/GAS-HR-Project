import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { authenticateToken } from "../middleware_auth.js";
import {
  getUserByUsernameRepo,
  recordFailedLoginRepo,
  recordSuccessfulLoginRepo,
} from "../data/userEmployeeRepository.js";
import {
  addLoginAttemptRepo,
  addSecurityEventRepo,
} from "../data/securityRepository.js";

const router = Router();

function buildUserPayload(user) {
  return {
    id: user.id,
    username: user.username,
    name: user.name || user.username || "",
    role: user.roleName || user.roleCode || "Employee",
    roleName: user.roleName || "Employee",
    roleCode: user.roleCode || "employee",
    permissions: Array.isArray(user.permissions) ? user.permissions : [],
    projectId: user.projectId || null,
    packageId: user.packageId || null,
    division: user.division || null,
    accessScope: user.accessScope || null,
    jobTitle: user.jobTitle || null,
    gasId: user.gasId || null,
    nationalityType: user.nationalityType || null,
    status: user.status || "active",
  };
}

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res
        .status(400)
        .json({ message: "Username and password are required" });
    }

    const normalizedUsername = String(username).trim();
    const ipAddress = req.ip || req.headers["x-forwarded-for"] || "-";
    const userAgent = req.headers["user-agent"] || "-";

    const user = await getUserByUsernameRepo(normalizedUsername);

    if (!user) {
      await addLoginAttemptRepo({
        username: normalizedUsername,
        ipAddress,
        userAgent,
        status: "failed",
      });

      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (user.isLocked || user.status === "locked") {
      await addLoginAttemptRepo({
        username: normalizedUsername,
        ipAddress,
        userAgent,
        status: "locked",
      });

      await addSecurityEventRepo(
        "locked_login_attempt",
        user.id,
        { username: normalizedUsername },
        ipAddress
      );

      return res.status(423).json({ message: "Account is locked" });
    }

    if (!user.passwordHash) {
      console.error("Missing passwordHash for user:", user.username);

      await addSecurityEventRepo(
        "missing_password_hash",
        user.id,
        { username: user.username },
        ipAddress
      );

      return res.status(500).json({ message: "User password is not configured" });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);

    if (!isValid) {
      await addLoginAttemptRepo({
        username: normalizedUsername,
        ipAddress,
        userAgent,
        status: "failed",
      });

      await recordFailedLoginRepo(user, ipAddress);

      await addSecurityEventRepo(
        "failed_login",
        user.id,
        { username: normalizedUsername },
        ipAddress
      );

      return res.status(401).json({ message: "Invalid credentials" });
    }

    await addLoginAttemptRepo({
      username: normalizedUsername,
      ipAddress,
      userAgent,
      status: "success",
    });

    await recordSuccessfulLoginRepo(user, ipAddress);

    await addSecurityEventRepo(
      "successful_login",
      user.id,
      { username: normalizedUsername },
      ipAddress
    );

    const payload = buildUserPayload(user);

    const token = jwt.sign(payload, process.env.JWT_SECRET || "dev-secret", {
      expiresIn: "12h",
    });

    return res.json({
      token,
      user: payload,
    });
  } catch (error) {
    console.error("Login route error:", error);
    return res.status(500).json({ message: "Login failed" });
  }
});

router.get("/session", authenticateToken, async (req, res) => {
  try {
    const username = req.user?.username;

    if (!username) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const freshUser = await getUserByUsernameRepo(username);

    if (!freshUser) {
      return res.status(401).json({ message: "User not found" });
    }

    return res.json({
      user: buildUserPayload(freshUser),
    });
  } catch (error) {
    console.error("Session route error:", error);
    return res.status(500).json({ message: "Failed to load session" });
  }
});

router.post("/logout", authenticateToken, async (req, res) => {
  try {
    await addSecurityEventRepo(
      "logout",
      req.user?.id || null,
      { username: req.user?.username || null },
      req.ip || "-"
    );

    return res.json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout route error:", error);
    return res.status(500).json({ message: "Logout failed" });
  }
});

export default router;
