import { Router } from 'express';
import { db, getPackageById, getProjectById, getRoleById } from '../data/store.js';
import { addLoginAttemptRepo, addSecurityEventRepo, findValidRefreshTokenRepo, revokeRefreshTokenRepo, storeRefreshTokenRepo } from '../data/securityRepository.js';
import { getUserByIdRepo, getUserByUsernameRepo, recordFailedLoginRepo, recordSuccessfulLoginRepo } from '../data/userEmployeeRepository.js';
import { authenticateToken } from '../middleware_auth.js';
import { generateRefreshToken, issueAccessToken, verifyPassword } from '../utils/security.js';

const router = Router();

function serializeUser(user) {
  const role = getRoleById(user.roleId);
  const project = user.projectId ? getProjectById(user.projectId) : null;
  const pkg = user.packageId ? getPackageById(user.packageId) : null;
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    gasId: user.gasId,
    nationalityType: user.nationalityType,
    division: user.division,
    jobTitle: user.jobTitle,
    role: role?.name || user.roleName,
    permissions: user.permissions,
    accessScope: user.accessScope,
    allowDuringMaintenance: user.allowDuringMaintenance,
    project: project?.name || 'All Projects',
    package: pkg?.name || 'All Packages',
    status: user.status,
    mustChangePassword: user.mustChangePassword
  };
}

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await getUserByUsernameRepo(username);
  const ipAddress = req.ip;
  const userAgent = req.headers['user-agent'] || '-';

  if (!user) {
    await addLoginAttemptRepo({ username, ipAddress, userAgent, status: 'failed' });
    return res.status(401).json({ message: 'بيانات الدخول غير صحيحة' });
  }

  if (user.status === 'locked' || user.isLocked) {
    await addLoginAttemptRepo({ username, ipAddress, userAgent, status: 'locked' });
    return res.status(423).json({ message: 'الحساب مقفل ويحتاج فتح من System Owner' });
  }

  if (!verifyPassword(password, user.passwordHash)) {
    const updatedUser = await recordFailedLoginRepo(user, ipAddress);
    await addLoginAttemptRepo({ username, ipAddress, userAgent, status: 'failed' });
    if ((updatedUser?.failedAttempts || user.failedAttempts || 0) >= 5) {
      await addSecurityEventRepo('account_locked', user.id, { reason: 'too_many_failed_attempts' }, ipAddress);
    }
    return res.status(401).json({ message: 'بيانات الدخول غير صحيحة' });
  }

  if (db.settings.maintenanceMode && !user.allowDuringMaintenance && user.roleId !== 1) {
    return res.status(503).json({ message: 'الموقع تحت الصيانة حالياً' });
  }

  const freshUser = await recordSuccessfulLoginRepo(user, ipAddress);

  const accessToken = issueAccessToken(user);
  const refreshToken = generateRefreshToken();
  await storeRefreshTokenRepo((freshUser || user).id, refreshToken);
  await addLoginAttemptRepo({ username, ipAddress, userAgent, status: 'success' });
  await addSecurityEventRepo('login_success', user.id, {}, ipAddress);

  return res.json({ user: serializeUser(freshUser || user), accessToken, refreshToken });
});

router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ message: 'refreshToken مطلوب' });
  const tokenRecord = await findValidRefreshTokenRepo(refreshToken);
  if (!tokenRecord) return res.status(401).json({ message: 'Refresh token غير صالح' });
  const user = await getUserByIdRepo(tokenRecord.userId);
  if (!user || user.status !== 'active') return res.status(401).json({ message: 'المستخدم غير متاح' });
  const accessToken = issueAccessToken(user);
  return res.json({ accessToken, user: serializeUser(user) });
});

router.post('/logout', authenticateToken, async (req, res) => {
  if (req.body.refreshToken) await revokeRefreshTokenRepo(req.body.refreshToken);
  await addSecurityEventRepo('logout', req.user.id, {});
  return res.json({ message: 'تم تسجيل الخروج' });
});

router.get('/session', authenticateToken, (req, res) => {
  return res.json({ user: serializeUser(req.user) });
});

export default router;
