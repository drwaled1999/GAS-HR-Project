import express from 'express';
import { saveDatabaseSnapshot, getDatabaseHealth } from '../data/database.js';
import { authenticateToken, requirePermission } from '../middleware_auth.js';

const router = express.Router();

router.get('/db-health', authenticateToken, async (_req, res) => {
  const health = await getDatabaseHealth();
  res.json(health);
});

router.post('/db-save', authenticateToken, requirePermission('edit_user'), async (_req, res) => {
  await saveDatabaseSnapshot();
  res.json({ ok: true, message: 'Database snapshot saved.' });
});

export default router;
