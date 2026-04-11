import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-in-production';
const ACCESS_TOKEN_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES_IN_DAYS = Number(process.env.REFRESH_TOKEN_EXPIRES_IN_DAYS || 7);

export function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

export function issueAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      username: user.username,
      roleId: user.roleId,
      division: user.division,
      projectId: user.projectId,
      packageId: user.packageId,
      accessScope: user.accessScope,
      permissions: user.permissions,
      allowDuringMaintenance: user.allowDuringMaintenance
    },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

export function generateRefreshToken() {
  return crypto.randomBytes(48).toString('hex');
}

export function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

export function getRefreshExpiryDate() {
  const date = new Date();
  date.setDate(date.getDate() + REFRESH_TOKEN_EXPIRES_IN_DAYS);
  return date.toISOString();
}
