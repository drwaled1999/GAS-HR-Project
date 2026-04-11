import { authenticateToken, enforceMaintenance, requireSystemOwner } from '../middleware_auth.js';
import { Router } from 'express';
import { addAuditLog, db } from '../data/store.js';

const router = Router();
router.use(authenticateToken, enforceMaintenance);

router.get('/', (_req, res) => {
  res.json({ settings: db.settings, auditLogs: db.auditLogs.slice(0, 25) });
});

router.post('/maintenance', requireSystemOwner, (req, res) => {
  db.settings.maintenanceMode = Boolean(req.body.enabled);
  addAuditLog('maintenance_mode_changed', req.user?.name || 'System Owner', {
    enabled: db.settings.maintenanceMode
  });
  res.json({ settings: db.settings });
});

export default router;
