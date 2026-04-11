import { db } from "./store.js";
import { getPool, shouldUsePostgres } from "./database.js";
import { sha256, getRefreshExpiryDate } from "../utils/security.js";

function syncInto(arrName, item, key='id') {
  const arr = db[arrName];
  const idx = arr.findIndex((x) => x[key] === item[key]);
  if (idx >= 0) arr[idx] = { ...arr[idx], ...item };
  else arr.unshift(item);
  return item;
}

function mapLoginAttemptRow(row) {
  return {
    id: Number(row.id),
    username: row.username,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    status: row.status,
    createdAt: row.created_at
  };
}
function mapSecurityEventRow(row) {
  return {
    id: Number(row.id),
    userId: row.user_id == null ? null : Number(row.user_id),
    eventType: row.event_type,
    details: row.details || {},
    ipAddress: row.ip_address || '-',
    createdAt: row.created_at
  };
}
function mapAuditLogRow(row) {
  return {
    id: Number(row.id),
    action: row.action,
    actorName: row.actor_name,
    details: row.details || {},
    createdAt: row.created_at
  };
}
function mapRefreshTokenRow(row) {
  return {
    id: Number(row.id),
    userId: Number(row.user_id),
    tokenHash: row.token_hash,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at
  };
}

export async function addLoginAttemptRepo({ username, ipAddress, userAgent, status }) {
  const item = { id: db.loginAttempts.length + 1, username, ipAddress, userAgent, status, createdAt: new Date().toISOString() };
  syncInto('loginAttempts', item);
  if (!shouldUsePostgres()) return item;
  const { rows } = await getPool().query(`INSERT INTO login_attempts (username, ip_address, user_agent, status) VALUES ($1,$2,$3,$4) RETURNING *`, [username, ipAddress || '-', userAgent || '-', status]);
  return syncInto('loginAttempts', mapLoginAttemptRow(rows[0]));
}

export async function addSecurityEventRepo(eventType, userId, details = {}, ipAddress = '-') {
  const item = { id: db.securityEvents.length + 1, userId: userId == null ? null : Number(userId), eventType, details, ipAddress, createdAt: new Date().toISOString() };
  syncInto('securityEvents', item);
  if (!shouldUsePostgres()) return item;
  const { rows } = await getPool().query(`INSERT INTO security_events (user_id, event_type, details, ip_address) VALUES ($1,$2,$3::jsonb,$4) RETURNING *`, [userId == null ? null : Number(userId), eventType, JSON.stringify(details || {}), ipAddress || '-']);
  return syncInto('securityEvents', mapSecurityEventRow(rows[0]));
}

export async function addAuditLogRepo(action, actorName, details = {}) {
  const item = { id: db.auditLogs.length + 1, action, actorName, details, createdAt: new Date().toISOString() };
  syncInto('auditLogs', item);
  if (!shouldUsePostgres()) return item;
  const { rows } = await getPool().query(`INSERT INTO audit_logs (action, actor_name, details) VALUES ($1,$2,$3::jsonb) RETURNING *`, [action, actorName || 'System', JSON.stringify(details || {})]);
  return syncInto('auditLogs', mapAuditLogRow(rows[0]));
}

export async function storeRefreshTokenRepo(userId, rawToken) {
  const item = { id: db.refreshTokens.length + 1, userId: Number(userId), tokenHash: sha256(rawToken), expiresAt: getRefreshExpiryDate(), revokedAt: null, createdAt: new Date().toISOString() };
  syncInto('refreshTokens', item);
  if (!shouldUsePostgres()) return item;
  const { rows } = await getPool().query(`INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1,$2,$3::timestamptz) RETURNING *`, [Number(userId), item.tokenHash, item.expiresAt]);
  return syncInto('refreshTokens', mapRefreshTokenRow(rows[0]));
}

export async function revokeRefreshTokenRepo(rawToken) {
  const tokenHash = sha256(rawToken);
  const local = db.refreshTokens.find((x) => x.tokenHash === tokenHash && !x.revokedAt);
  if (local) local.revokedAt = new Date().toISOString();
  if (!shouldUsePostgres()) return local || null;
  const { rows } = await getPool().query(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1 AND revoked_at IS NULL RETURNING *`, [tokenHash]);
  if (!rows[0]) return null;
  return syncInto('refreshTokens', mapRefreshTokenRow(rows[0]));
}

export async function findValidRefreshTokenRepo(rawToken) {
  const tokenHash = sha256(rawToken);
  if (!shouldUsePostgres()) {
    return db.refreshTokens.find((x) => x.tokenHash === tokenHash && !x.revokedAt && new Date(x.expiresAt) > new Date()) || null;
  }
  const { rows } = await getPool().query(`SELECT * FROM refresh_tokens WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > NOW() ORDER BY id DESC LIMIT 1`, [tokenHash]);
  if (!rows[0]) return null;
  return syncInto('refreshTokens', mapRefreshTokenRow(rows[0]));
}

export async function listLoginAttemptsRepo(limit=20) {
  if (!shouldUsePostgres()) return db.loginAttempts.slice(0, limit);
  const { rows } = await getPool().query(`SELECT * FROM login_attempts ORDER BY created_at DESC LIMIT $1`, [Number(limit)]);
  const items = rows.map(mapLoginAttemptRow); items.forEach((i)=>syncInto('loginAttempts', i)); return items;
}
export async function listSecurityEventsRepo(limit=20) {
  if (!shouldUsePostgres()) return db.securityEvents.slice(0, limit);
  const { rows } = await getPool().query(`SELECT * FROM security_events ORDER BY created_at DESC LIMIT $1`, [Number(limit)]);
  const items = rows.map(mapSecurityEventRow); items.forEach((i)=>syncInto('securityEvents', i)); return items;
}
export async function listAuditLogsRepo(limit=20) {
  if (!shouldUsePostgres()) return db.auditLogs.slice(0, limit);
  const { rows } = await getPool().query(`SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT $1`, [Number(limit)]);
  const items = rows.map(mapAuditLogRow); items.forEach((i)=>syncInto('auditLogs', i)); return items;
}
export async function getSecurityCountsRepo() {
  if (!shouldUsePostgres()) {
    return {
      failedLogins: db.loginAttempts.filter((a) => a.status === 'failed').length,
      lockedAttempts: db.loginAttempts.filter((a) => a.status === 'locked').length,
      securityEvents: db.securityEvents.length,
      auditLogs: db.auditLogs.length,
      refreshTokens: db.refreshTokens.length
    };
  }
  const pool = getPool();
  const [failed, locked, events, audits, tokens] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS count FROM login_attempts WHERE status = 'failed'`),
    pool.query(`SELECT COUNT(*)::int AS count FROM login_attempts WHERE status = 'locked'`),
    pool.query(`SELECT COUNT(*)::int AS count FROM security_events`),
    pool.query(`SELECT COUNT(*)::int AS count FROM audit_logs`),
    pool.query(`SELECT COUNT(*)::int AS count FROM refresh_tokens WHERE revoked_at IS NULL AND expires_at > NOW()`)
  ]);
  return {
    failedLogins: failed.rows[0].count,
    lockedAttempts: locked.rows[0].count,
    securityEvents: events.rows[0].count,
    auditLogs: audits.rows[0].count,
    refreshTokens: tokens.rows[0].count
  };
}
