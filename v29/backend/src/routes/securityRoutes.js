import { Router } from 'express';
import { authenticateToken, enforceMaintenance, requireSystemOwner } from '../middleware_auth.js';
import { listLockedUsers } from '../data/index.js';
import { listAuditLogsRepo, listLoginAttemptsRepo, listSecurityEventsRepo, getSecurityCountsRepo, addSecurityEventRepo } from '../data/securityRepository.js';
import { unlockUserRepo } from '../data/userEmployeeRepository.js';

const router = Router();
router.use(authenticateToken, enforceMaintenance, requireSystemOwner);

router.get('/overview', async (_req, res) => {
  const lockedUsers = listLockedUsers();
  const summary = await getSecurityCountsRepo();
  const [recentLoginAttempts, recentSecurityEvents, recentAuditLogs] = await Promise.all([
    listLoginAttemptsRepo(20),
    listSecurityEventsRepo(20),
    listAuditLogsRepo(20)
  ]);
  return res.json({
    summary: { ...summary, lockedUsers: lockedUsers.length },
    lockedUsers: lockedUsers.map((u) => ({
      id: u.id,
      username: u.username,
      name: u.name,
      gasId: u.gasId,
      division: u.division,
      jobTitle: u.jobTitle,
      failedAttempts: u.failedAttempts || 0,
      lastLoginAt: u.lastLoginAt,
      lastLoginIp: u.lastLoginIp
    })),
    recentLoginAttempts,
    recentSecurityEvents,
    recentAuditLogs
  });
});

router.post('/users/:id/unlock', async (req, res) => {
  const user = await unlockUserRepo(req.params.id, req.user?.name || 'System Owner');
  if (!user) return res.status(404).json({ message: 'المستخدم غير موجود' });
  await addSecurityEventRepo('account_unlocked', user.id, { by: req.user?.name || 'System Owner' });
  return res.json({ message: 'تم فتح الحساب', user });
});

export default router;
