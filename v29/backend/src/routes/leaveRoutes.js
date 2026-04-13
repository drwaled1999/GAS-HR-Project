import { authenticateToken, enforceMaintenance } from '../middleware_auth.js';

import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { db } from '../data/index.js';
import { getEmployeeByGasIdRepo, getUserByIdRepo } from '../data/userEmployeeRepository.js';
import {
  createLeaveRequestRepo,
  reviewLeaveRequestRepo,
  listScopedLeaveRequestsRepo,
  createNotificationRepo,
  listScopedLeaveBalancesRepo,
  listLeavePoliciesRepo,
  updateLeavePolicyRepo,
  updateLeaveBalanceRepo
} from '../data/leaveNotificationRepository.js';

const router = Router();
router.use(authenticateToken, enforceMaintenance);
const uploadDir = path.resolve('src/uploads/requests');
fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ dest: uploadDir });

const requestTypes = [
  { code: 'annual_leave', label: 'Annual Leave', category: 'leave', requiresAttachment: false, requiresDateRange: true },
  { code: 'sick_leave', label: 'Sick Leave', category: 'leave', requiresAttachment: true, requiresDateRange: true },
  { code: 'emergency_leave', label: 'Emergency Leave', category: 'leave', requiresAttachment: true, requiresDateRange: true },
  { code: 'hajj_leave', label: 'Hajj Leave', category: 'leave', requiresAttachment: true, requiresDateRange: true },
  { code: 'umrah_leave', label: 'Umrah Leave', category: 'leave', requiresAttachment: true, requiresDateRange: true },
  { code: 'business_trip', label: 'Business Trip', category: 'task', requiresAttachment: false, requiresDateRange: true },
  { code: 'task_assignment', label: 'Task Assignment', category: 'task', requiresAttachment: true, requiresDateRange: true },
  { code: 'salary_transfer', label: 'Salary Transfer', category: 'payroll', requiresAttachment: true, requiresDateRange: false, requiresBankFields: true }
];

router.get('/types', (_req, res) => {
  res.json({ types: requestTypes });
});

router.get('/balances', async (req, res) => {
  const user = req.user;
  if (!user) return res.status(404).json({ message: 'User not found' });
  return res.json({ balances: await listScopedLeaveBalancesRepo(user) });
});

router.get('/policies', async (_req, res) => {
  return res.json({ policies: await listLeavePoliciesRepo() });
});

router.post('/policies/:code', async (req, res) => {
  const user = req.user;
  if (!user || !(user.roleId === 1 || user.permissions?.includes('*') || user.permissions?.includes('manage_leave_types'))) {
    return res.status(403).json({ message: 'Not allowed' });
  }
  const policy = await updateLeavePolicyRepo(req.params.code, req.body, user.name);
  if (!policy) return res.status(404).json({ message: 'Policy not found' });
  return res.json({ policy, message: 'Leave policy updated successfully' });
});

router.post('/balances/:employeeId', async (req, res) => {
  const user = req.user;
  if (!user || !(user.roleId === 1 || user.permissions?.includes('*') || user.permissions?.includes('manage_leave_balances'))) {
    return res.status(403).json({ message: 'Not allowed' });
  }
  const balance = await updateLeaveBalanceRepo(req.params.employeeId, req.body, user.name);
  return res.json({ balance, message: 'Leave balance updated successfully' });
});

router.get('/list', async (req, res) => {
  const user = req.user;
  if (!user) return res.status(404).json({ message: 'المستخدم غير موجود' });
  const attendanceAdjustments = db.attendanceAdjustments;
  const leaveRequests = await listScopedLeaveRequestsRepo(user);
  return res.json({ attendanceAdjustments, leaveRequests });
});

router.post('/leave', upload.single('attachment'), async (req, res) => {
  const user = req.user;
  if (!user) return res.status(404).json({ message: 'المستخدم غير موجود' });
  const typeDef = requestTypes.find((t) => t.code === req.body.type);
  if (!typeDef) return res.status(400).json({ message: 'نوع الطلب غير مدعوم' });

  if (typeDef.requiresAttachment && !req.file) {
    return res.status(400).json({ message: 'المرفق مطلوب لهذا النوع من الطلبات' });
  }

  const normalizedIban = String(req.body.newIban || '').replace(/\s+/g, '').toUpperCase();
  if (typeDef.requiresBankFields) {
    if (!req.body.currentBank || !req.body.newBank || !normalizedIban) {
      return res.status(400).json({ message: 'بيانات تحويل الراتب غير مكتملة' });
    }
    if (!/^SA[0-9A-Z]{22}$/.test(normalizedIban)) {
      return res.status(400).json({ message: 'صيغة الآيبان الجديد غير صحيحة' });
    }
  }

  let employeeId = req.body.employeeId ? Number(req.body.employeeId) : null;
  if (!employeeId && req.body.employeeGasId) {
    const employee = await getEmployeeByGasIdRepo(req.body.employeeGasId);
    employeeId = employee?.id || null;
  }
  if (!employeeId) return res.status(400).json({ message: 'الموظف غير موجود أو لم يتم تحديده' });

  const today = new Date().toISOString().slice(0, 10);
  const employeeRecord = employeeId ? (db.employees.find(e => Number(e.id) === Number(employeeId)) || await getEmployeeByGasIdRepo(req.body.employeeGasId || '')) : null;
  const item = await createLeaveRequestRepo({
    employeeId,
    employeeName: employeeRecord?.name || '-',
    employeeGasId: employeeRecord?.gasId || req.body.employeeGasId || '-',
    projectId: employeeRecord?.projectId || null,
    packageId: employeeRecord?.packageId || null,
    type: typeDef.label,
    category: typeDef.category,
    startDate: typeDef.requiresDateRange ? req.body.startDate : (req.body.startDate || today),
    endDate: typeDef.requiresDateRange ? req.body.endDate : (req.body.endDate || today),
    note: req.body.note,
    attachmentName: req.file?.originalname || null,
    attachmentPath: req.file ? `${path.basename(req.file.path)}` : null,
    currentBank: req.body.currentBank || '',
    newBank: req.body.newBank || '',
    newIban: normalizedIban,
    requestedById: user.id,
    requestedByName: user.name
  }, user.name);

  if (item.approverUserId) {
    await createNotificationRepo(
      item.approverUserId,
      item.type === 'Salary Transfer' ? `New salary transfer request for ${item.employeeName} from ${user.name}` : `New ${item.type} request for ${item.employeeName} from ${user.name}`,
      'leave-request',
      '/requests',
      { requestId: item.id, requestType: item.type }
    );
  }

  return res.json({ request: item, message: 'تم إرسال طلب الإجازة/السكليف بنجاح' });
});

router.post('/leave/:id/review', async (req, res) => {
  const reviewer = req.user;
  if (!reviewer) return res.status(404).json({ message: 'المستخدم غير موجود' });
  const decision = req.body.decision;
  if (!['approved', 'rejected'].includes(decision)) {
    return res.status(400).json({ message: 'قرار غير صالح' });
  }

  const item = await reviewLeaveRequestRepo(req.params.id, {
    decision,
    reviewerId: reviewer.id,
    reviewerName: reviewer.name,
    rejectionReason: req.body.rejectionReason || ''
  }, reviewer.name);

  if (!item) return res.status(404).json({ message: 'الطلب غير موجود' });

  await createNotificationRepo(
    item.requestedById,
    `${item.type} request for ${item.employeeName} was ${decision}`,
    'leave-request-result',
    '/requests',
    { requestId: item.id, decision }
  );

  return res.json({ request: item, message: decision === 'approved' ? 'تمت الموافقة على الطلب وتحديث الحضور تلقائيًا' : 'تم رفض الطلب' });
});


export default router;
