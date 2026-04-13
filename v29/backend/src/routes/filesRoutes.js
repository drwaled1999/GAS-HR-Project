import { Router } from 'express';
import path from 'path';
import { authenticateToken, enforceMaintenance } from '../middleware_auth.js';
import { addSecurityEvent, db } from '../data/index.js';

const router = Router();
router.use(authenticateToken, enforceMaintenance);

router.get('/request/:id', (req, res) => {
  const item = db.leaveRequests.find((request) => request.id === Number(req.params.id));
  if (!item || !item.attachmentPath) return res.status(404).json({ message: 'المرفق غير موجود' });
  const isOwner = item.requestedById === req.user.id || req.user.roleId === 1;
  const isApprover = item.approverUserId === req.user.id;
  if (!isOwner && !isApprover && !req.user.permissions?.includes('view_users')) {
    return res.status(403).json({ message: 'ليس لديك صلاحية فتح هذا المرفق' });
  }
  addSecurityEvent('attachment_view', req.user.id, { requestId: item.id, file: item.attachmentName });
  const abs = path.resolve('backend/src/uploads/requests', path.basename(item.attachmentPath));
  return res.sendFile(abs);
});

export default router;
