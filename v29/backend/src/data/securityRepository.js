import { query } from "./index.js";
import { sha256, getRefreshExpiryDate } from "../utils/security.js";

function mapLoginAttemptRow(row) {
  if (!row) return null;

  return {
    id: row.id,
    username: row.username,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    status: row.status,
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
    SELECT *
    FROM security_events
    ORDER BY created_at DESC
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
      FROM login_attempts
      WHERE status = 'locked'
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
    query(
      `
      SELECT COUNT(*)::int AS count
      FROM refresh_tokens
      WHERE revoked_at IS NULL
        AND expires_at > NOW()
      `
    ),
  ]);

  return {
    failedLogins: Number(failed.rows[0]?.count || 0),
    lockedAttempts: Number(locked.rows[0]?.count || 0),
    securityEvents: Number(events.rows[0]?.count || 0),
    auditLogs: Number(audits.rows[0]?.count || 0),
    refreshTokens: Number(tokens.rows[0]?.count || 0),
  };
}