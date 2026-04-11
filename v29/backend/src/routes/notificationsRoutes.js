import { authenticateToken, enforceMaintenance } from '../middleware_auth.js';
import { Router } from 'express';
import {
  listNotificationsForUserRepo,
  getUnreadNotificationsCountRepo,
  markNotificationReadRepo,
  markAllNotificationsReadRepo
} from '../data/leaveNotificationRepository.js';

const router = Router();
router.use(authenticateToken, enforceMaintenance);

router.get('/', async (req, res) => {
  const user = req.user;
  return res.json({
    items: await listNotificationsForUserRepo(user.id),
    unreadCount: await getUnreadNotificationsCountRepo(user.id)
  });
});

router.post('/:id/read', async (req, res) => {
  const user = req.user;
  const item = await markNotificationReadRepo(req.params.id, user.id);
  if (!item) return res.status(404).json({ message: 'الإشعار غير موجود' });
  return res.json({ item, unreadCount: await getUnreadNotificationsCountRepo(user.id) });
});

router.post('/read-all', async (req, res) => {
  const user = req.user;
  const updated = await markAllNotificationsReadRepo(user.id);
  return res.json({ updated, unreadCount: await getUnreadNotificationsCountRepo(user.id) });
});

export default router;
