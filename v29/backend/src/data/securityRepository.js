import { query } from "./index.js";
import { sha256, getRefreshExpiryDate } from "../utils/security.js";

function riskForEvent(value, status = "") {
  const text = `${value || ""} ${status || ""}`.toLowerCase();
  if (/critical|breach|owner_changed|privilege_escalation/.test(text)) return "critical";
  if (/locked|blocked|disabled|2fa_disable|permission|unauthorized|failed/.test(text)) return "high";
  if (/password|unlock|recovery|new_device/.test(text)) return "medium";
  return "low";
}

function mapLoginAttemptRow(row) {
  if (!row) return null;

  return {
    id: row.id,
    username: row.username,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    status: row.status,
    risk: riskForEvent("login", row.status),
    createdAt: row.created_at,
  };
}

function mapSecurityEventRow(row) {
  if (!row) return null;

  return {
    id: row.id,
    userId: row.user_id ?? null,
    eventType: row.event_type,
    details: row.details || {},
    ipAddress: row.ip_address || "-",
    username: row.username || null,
    userName: row.user_name || null,
    risk: riskForEvent(row.event_type, row.details?.status),
    createdAt: row.created_at,
  };
}

function mapAuditLogRow(row) {
  if (!row) return null;

  return {
    id: row.id,
    action: row.action,
    actorName: row.actor_name,
    details: row.details || {},
    createdAt: row.created_at,
  };
}

function mapRefreshTokenRow(row) {
  if (!row) return null;

  return {
    id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
  };
}

export async function addLoginAttemptRepo({
  username,
  ipAddress,
  userAgent,
  status,
}) {
  const { rows } = await query(
    `
    INSERT INTO login_attempts (
      username,
      ip_address,
      user_agent,
      status
    )
    VALUES ($1, $2, $3, $4)
    RETURNING *
    `,
    [username, ipAddress || "-", userAgent || "-", status]
  );

  return mapLoginAttemptRow(rows[0]);
}

export async function addSecurityEventRepo(
  eventType,
  userId,
  details = {},
  ipAddress = "-"
) {
  const { rows } = await query(
    `
    INSERT INTO security_events (
      user_id,
      event_type,
      details,
      ip_address
    )
    VALUES ($1, $2, $3::jsonb, $4)
    RETURNING *
    `,
    [userId ?? null, eventType, JSON.stringify(details || {}), ipAddress || "-"]
  );

  return mapSecurityEventRow(rows[0]);
}

export async function addAuditLogRepo(action, actorName, details = {}) {
  const { rows } = await query(
    `
    INSERT INTO audit_logs (
      action,
      actor_name,
      details
    )
    VALUES ($1, $2, $3::jsonb)
    RETURNING *
    `,
    [action, actorName || "System", JSON.stringify(details || {})]
  );

  return mapAuditLogRow(rows[0]);
}

export async function storeRefreshTokenRepo(userId, rawToken) {
  const tokenHash = sha256(rawToken);
  const expiresAt = getRefreshExpiryDate();

  const { rows } = await query(
    `
    INSERT INTO refresh_tokens (
      user_id,
      token_hash,
      expires_at
    )
    VALUES ($1, $2, $3::timestamptz)
    RETURNING *
    `,
    [userId, tokenHash, expiresAt]
  );

  return mapRefreshTokenRow(rows[0]);
}

export async function revokeRefreshTokenRepo(rawToken) {
  const tokenHash = sha256(rawToken);

  const { rows } = await query(
    `
    UPDATE refresh_tokens
    SET revoked_at = NOW()
    WHERE token_hash = $1
      AND revoked_at IS NULL
    RETURNING *
    `,
    [tokenHash]
  );

  if (!rows[0]) return null;
  return mapRefreshTokenRow(rows[0]);
}

export async function findValidRefreshTokenRepo(rawToken) {
  const tokenHash = sha256(rawToken);

  const { rows } = await query(
    `
    SELECT *
    FROM refresh_tokens
    WHERE token_hash = $1
      AND revoked_at IS NULL
      AND expires_at > NOW()
    ORDER BY created_at DESC, id DESC
    LIMIT 1
    `,
    [tokenHash]
  );

  if (!rows[0]) return null;
  return mapRefreshTokenRow(rows[0]);
}

export async function listLoginAttemptsRepo(limit = 20) {
  const { rows } = await query(
    `
    SELECT *
    FROM login_attempts
    ORDER BY created_at DESC
    LIMIT $1
    `,
    [Number(limit)]
  );

  return rows.map(mapLoginAttemptRow);
}

export async function listSecurityEventsRepo(limit = 20) {
  const { rows } = await query(
    `
    SELECT se.*, u.username, COALESCE(u.full_name, u.name, u.username) AS user_name
    FROM security_events se
    LEFT JOIN users u ON u.id = se.user_id
    ORDER BY se.created_at DESC
    LIMIT $1
    `,
    [Number(limit)]
  );

  return rows.map(mapSecurityEventRow);
}

export async function listAuditLogsRepo(limit = 20) {
  const { rows } = await query(
    `
    SELECT *
    FROM audit_logs
    ORDER BY created_at DESC
    LIMIT $1
    `,
    [Number(limit)]
  );

  return rows.map(mapAuditLogRow);
}

export async function getSecurityCountsRepo() {
  const [failed, locked, events, audits, tokens] = await Promise.all([
    query(
      `
      SELECT COUNT(*)::int AS count
      FROM login_attempts
      WHERE status = 'failed'
      `
    ),
    query(
      `
      SELECT COUNT(*)::int AS count
      FROM users
      WHERE status = 'locked'
         OR is_locked = TRUE
         OR locked_until > NOW()
      `
    ),
    query(
      `
      SELECT COUNT(*)::int AS count
      FROM security_events
      `
    ),
    query(
      `
      SELECT COUNT(*)::int AS count
      FROM audit_logs
      `
    ),
    query(`SELECT COUNT(*)::int AS count FROM security_sessions
           WHERE revoked_at IS NULL AND expires_at > NOW()`),
  ]);

  return {
    failedLogins: Number(failed.rows[0]?.count || 0),
    lockedAttempts: Number(locked.rows[0]?.count || 0),
    securityEvents: Number(events.rows[0]?.count || 0),
    auditLogs: Number(audits.rows[0]?.count || 0),
    refreshTokens: Number(tokens.rows[0]?.count || 0),
  };
}

export async function createSecuritySessionRepo(userId, ipAddress, userAgent) {
  const { rows } = await query(
    `INSERT INTO security_sessions (user_id, ip_address, user_agent, expires_at)
     VALUES ($1, $2, $3, NOW() + INTERVAL '12 hours') RETURNING id`,
    [userId, ipAddress || "-", userAgent || "-"]
  );
  return rows[0]?.id || null;
}

export async function listActiveSessionsRepo(limit = 100) {
  const { rows } = await query(
    `SELECT s.id, s.user_id, s.ip_address, s.user_agent, s.created_at,
            s.last_seen_at, s.expires_at, u.username,
            COALESCE(u.full_name, u.name, u.username) AS user_name
     FROM security_sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.revoked_at IS NULL AND s.expires_at > NOW()
     ORDER BY s.last_seen_at DESC LIMIT $1`,
    [Number(limit)]
  );
  return rows.map((row) => ({
    id: row.id, userId: row.user_id, username: row.username,
    userName: row.user_name, ipAddress: row.ip_address || "-",
    userAgent: row.user_agent || "-", createdAt: row.created_at,
    lastSeenAt: row.last_seen_at, expiresAt: row.expires_at,
  }));
}

export async function revokeSecuritySessionRepo(sessionId, revokedBy) {
  const { rows } = await query(
    `UPDATE security_sessions SET revoked_at = NOW(), revoked_by = $2
     WHERE id = $1 AND revoked_at IS NULL RETURNING id, user_id`,
    [sessionId, revokedBy || null]
  );
  return rows[0] || null;
}

export async function revokeAllUserSessionsRepo(userId, revokedBy, exceptSessionId = null) {
  const { rows } = await query(
    `UPDATE security_sessions SET revoked_at = NOW(), revoked_by = $2
     WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW()
       AND ($3::uuid IS NULL OR id <> $3::uuid)
     RETURNING id`,
    [userId, revokedBy || null, exceptSessionId || null]
  );
  return rows.length;
}

export async function getSecurityAnalyticsRepo(days = 30) {
  const safeDays = Math.min(90, Math.max(7, Number(days) || 30));
  const { rows } = await query(
    `WITH calendar AS (
       SELECT generate_series(
         CURRENT_DATE - ($1::int - 1), CURRENT_DATE, INTERVAL '1 day'
       )::date AS day
     )
     SELECT c.day,
       COUNT(la.id)::int AS total,
       COUNT(la.id) FILTER (WHERE la.status = 'success')::int AS success,
       COUNT(la.id) FILTER (WHERE la.status IN ('failed', 'blocked'))::int AS failed,
       COUNT(la.id) FILTER (WHERE la.status = 'locked')::int AS locked
     FROM calendar c
     LEFT JOIN login_attempts la ON la.created_at >= c.day
       AND la.created_at < c.day + INTERVAL '1 day'
     GROUP BY c.day ORDER BY c.day ASC`,
    [safeDays]
  );
  const series = rows.map((row) => ({
    date: row.day, total: Number(row.total || 0), success: Number(row.success || 0),
    failed: Number(row.failed || 0), locked: Number(row.locked || 0),
  }));
  return {
    days: safeDays,
    series,
    totals: series.reduce((total, item) => ({
      total: total.total + item.total,
      success: total.success + item.success,
      failed: total.failed + item.failed,
      locked: total.locked + item.locked,
    }), { total: 0, success: 0, failed: 0, locked: 0 }),
  };
}

export async function listTwoFactorStatusRepo(limit = 100) {
  const { rows } = await query(
    `SELECT u.id, u.username, COALESCE(u.full_name, u.name, u.username) AS user_name,
            u.two_factor_enabled, u.two_factor_enabled_at,
            COALESCE(r.name, r.code, 'Employee') AS role_name
     FROM users u LEFT JOIN roles r ON r.id = u.role_id
     WHERE COALESCE(u.is_active, TRUE) = TRUE
     ORDER BY u.two_factor_enabled ASC, user_name ASC LIMIT $1`,
    [Number(limit)]
  );
  return rows.map((row) => ({
    id: row.id, username: row.username, userName: row.user_name,
    roleName: row.role_name, enabled: Boolean(row.two_factor_enabled),
    enabledAt: row.two_factor_enabled_at || null,
  }));
}

export async function listSecurityAlertsRepo() {
  const [failed, locked, events] = await Promise.all([
    query(`SELECT username, COUNT(*)::int AS count, MAX(created_at) AS created_at
           FROM login_attempts WHERE status IN ('failed', 'locked')
             AND created_at >= NOW() - INTERVAL '24 hours'
           GROUP BY username HAVING COUNT(*) >= 3 ORDER BY count DESC LIMIT 20`),
    query(`SELECT id, username, COALESCE(full_name, name, username) AS user_name, updated_at
           FROM users WHERE status = 'locked' OR is_locked = TRUE OR locked_until > NOW()
           ORDER BY updated_at DESC NULLS LAST LIMIT 20`),
    query(`SELECT se.id, se.event_type, se.created_at, se.details, u.username
           FROM security_events se LEFT JOIN users u ON u.id = se.user_id
           WHERE se.created_at >= NOW() - INTERVAL '24 hours'
           ORDER BY se.created_at DESC LIMIT 40`),
  ]);
  const alerts = failed.rows.map((row) => ({
    id: `failed-${row.username}`, type: "repeated_login_failures",
    username: row.username, count: Number(row.count), risk: Number(row.count) >= 8 ? "critical" : "high",
    createdAt: row.created_at,
  }));
  locked.rows.forEach((row) => alerts.push({
    id: `locked-${row.id}`, type: "account_locked", username: row.username,
    userName: row.user_name, risk: "high", createdAt: row.updated_at,
  }));
  events.rows.forEach((row) => {
    const risk = riskForEvent(row.event_type, row.details?.status);
    if (["high", "critical"].includes(risk)) alerts.push({
      id: `event-${row.id}`, type: row.event_type, username: row.username,
      details: row.details || {}, risk, createdAt: row.created_at,
    });
  });
  return alerts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 50);
}
