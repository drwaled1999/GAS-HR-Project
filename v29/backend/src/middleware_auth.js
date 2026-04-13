import { db } from "./data/index.js";
import { getUserByIdRepo } from './data/userEmployeeRepository.js';
import { verifyAccessToken } from './utils/security.js';

function getBearerToken(req) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  if (req.query.access_token) return String(req.query.access_token);
  return null;
}

export async function authenticateToken(req, res, next) {
  const token = getBearerToken(req);
  if (!token) return res.status(401).json({ message: 'يجب تسجيل الدخول أولاً' });
  try {
    const payload = verifyAccessToken(token);
    const user = await getUserByIdRepo(payload.sub);
    if (!user || user.status !== 'active') {
      return res.status(401).json({ message: 'الجلسة غير صالحة أو الحساب غير نشط' });
    }
    req.user = user;
    req.tokenPayload = payload;
    next();
  } catch (_error) {
    return res.status(401).json({ message: 'انتهت الجلسة أو التوكن غير صالح' });
  }
}

export function enforceMaintenance(req, res, next) {
  if (!db.settings.maintenanceMode) return next();
  const user = req.user;
  if (user?.roleId === 1 || user?.allowDuringMaintenance) return next();
  addSecurityEvent('maintenance_block', user?.id || null, { path: req.path });
  return res.status(503).json({ message: 'الموقع تحت الصيانة حالياً' });
}

export function requirePermission(permission) {
  return (req, res, next) => {
    const user = req.user;
    if (!user) return res.status(401).json({ message: 'غير مصرح' });
    if (user.roleId === 1 || user.permissions?.includes('*') || user.permissions?.includes(permission)) {
      return next();
    }
    addSecurityEvent('permission_denied', user.id, { permission, path: req.path });
    return res.status(403).json({ message: 'ليس لديك الصلاحية لهذه العملية' });
  };
}

export function requireSystemOwner(req, res, next) {
  if (req.user?.roleId === 1) return next();
  return res.status(403).json({ message: 'هذه العملية متاحة لـ System Owner فقط' });
}
