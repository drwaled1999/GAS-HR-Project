import { Router } from 'express';
import { authenticateToken, enforceMaintenance, requirePermission, requireSystemOwner } from '../middleware_auth.js';
import { hashPassword } from '../utils/security.js';
import {
  db,
  getPackageById,
  getProjectById,
  getRoleById
} from '../data/store.js';
import {
  archiveUserRepo,
  createUserRepo,
  getScopedEmployeesForUserRepo,
  getScopedUsersForUserRepo,
  getUserByIdRepo,
  resetUserPasswordRepo,
  transferUserRepo,
  unlockUserRepo,
  updateUserRepo
} from '../data/userEmployeeRepository.js';

const router = Router();
router.use(authenticateToken, enforceMaintenance);

function enrichUser(user) {
  const role = getRoleById(user.roleId);
  const project = user.projectId ? getProjectById(user.projectId) : null;
  const pkg = user.packageId ? getPackageById(user.packageId) : null;
  return {
    ...user,
    role: role?.name || user.roleName,
    projectName: project?.name || 'All Projects',
    packageName: pkg?.name || 'All Packages'
  };
}

router.get('/', async (req, res) => {
  const actor = req.user;
  const scopedUsers = await getScopedUsersForUserRepo(actor);
  const users = scopedUsers.map(enrichUser);
  const employees = actor ? await getScopedEmployeesForUserRepo(actor) : db.employees;
  res.json({ users, employees });
});

router.post('/', requirePermission('create_user'), async (req, res) => {
  const payload = req.body;
  const requiredFields = ['name', 'username', 'password', 'gasId', 'jobTitle', 'division', 'roleId', 'accessScope'];
  const missing = requiredFields.filter((field) => !payload[field]);

  if (missing.length) {
    return res.status(400).json({ message: `حقول ناقصة: ${missing.join(', ')}` });
  }

  if ((await getScopedUsersForUserRepo({ roleId: 1 })).some((user) => String(user.gasId) === String(payload.gasId))) {
    return res.status(409).json({ message: 'GAS ID موجود مسبقاً' });
  }

  const role = getRoleById(payload.roleId);
  const isSystemOwner = role?.name === 'System Owner';
  if (!isSystemOwner && !payload.projectId) {
    return res.status(400).json({ message: 'المشروع إجباري لهذا الحساب' });
  }

  if (!isSystemOwner && ['Engineer', 'Supervisor', 'Employee', 'HR Manager', 'HR'].includes(role?.name) && !payload.packageId) {
    return res.status(400).json({ message: 'البكج إجباري لهذا الحساب' });
  }

  if (payload.projectId && payload.packageId) {
    const pkg = getPackageById(payload.packageId);
    if (!pkg || pkg.projectId !== Number(payload.projectId)) {
      return res.status(400).json({ message: 'البكج لا يتبع للمشروع المختار' });
    }
  }

  payload.passwordHash = hashPassword(payload.password);
  const actor = req.user?.name || 'System Owner';
  const user = await createUserRepo(payload, actor);
  return res.status(201).json({ user: enrichUser(user) });
});



router.put('/:id', requirePermission('edit_user'), async (req, res) => {
  const actor = req.user;
  const target = await getUserByIdRepo(req.params.id);
  if (!target) {
    return res.status(404).json({ message: 'المستخدم غير موجود' });
  }

  const scopedIds = new Set((await getScopedUsersForUserRepo(actor)).map((item) => item.id));
  if (actor.roleId !== 1 && !scopedIds.has(target.id)) {
    return res.status(403).json({ message: 'لا يمكنك تعديل هذا المستخدم خارج نطاقك' });
  }

  const payload = req.body;
  const requiredFields = ['name', 'username', 'gasId', 'jobTitle', 'division', 'roleId', 'accessScope'];
  const missing = requiredFields.filter((field) => !payload[field]);
  if (missing.length) {
    return res.status(400).json({ message: `حقول ناقصة: ${missing.join(', ')}` });
  }

  if ((await getScopedUsersForUserRepo({ roleId: 1 })).some((user) => user.id !== Number(req.params.id) && String(user.gasId) === String(payload.gasId))) {
    return res.status(409).json({ message: 'GAS ID موجود مسبقاً' });
  }

  const role = getRoleById(payload.roleId);
  const isSystemOwner = role?.name === 'System Owner';
  if (!isSystemOwner && !payload.projectId) {
    return res.status(400).json({ message: 'المشروع إجباري لهذا الحساب' });
  }
  if (!isSystemOwner && ['Engineer', 'Supervisor', 'Employee', 'HR Manager', 'HR'].includes(role?.name) && !payload.packageId) {
    return res.status(400).json({ message: 'البكج إجباري لهذا الحساب' });
  }
  if (payload.projectId && payload.packageId) {
    const pkg = getPackageById(payload.packageId);
    if (!pkg || pkg.projectId !== Number(payload.projectId)) {
      return res.status(400).json({ message: 'البكج لا يتبع للمشروع المختار' });
    }
  }

  const updatePayload = { ...payload };
  if (payload.password) {
    updatePayload.passwordHash = hashPassword(payload.password);
  }

  const user = await updateUserRepo(req.params.id, updatePayload, actor?.name || 'System Owner');
  return res.json({ user: enrichUser(user) });
});

router.post('/:id/unlock', requireSystemOwner, async (req, res) => {
  const user = await unlockUserRepo(req.params.id, req.user?.name || 'System Owner');
  if (!user) {
    return res.status(404).json({ message: 'المستخدم غير موجود' });
  }
  return res.json({ user: enrichUser(user) });
});


router.post('/:id/reset-password', requirePermission('edit_user'), async (req, res) => {
  const actor = req.user;
  const target = await getUserByIdRepo(req.params.id);
  if (!target) return res.status(404).json({ message: 'المستخدم غير موجود' });
  const scopedIds = new Set((await getScopedUsersForUserRepo(actor)).map((item) => item.id));
  if (actor.roleId !== 1 && !scopedIds.has(target.id)) {
    return res.status(403).json({ message: 'لا يمكنك تعديل هذا المستخدم خارج نطاقك' });
  }
  const password = String(req.body.password || '').trim();
  if (password.length < 8) {
    return res.status(400).json({ message: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' });
  }
  const user = await resetUserPasswordRepo(req.params.id, hashPassword(password), actor?.name || 'System Owner');
  return res.json({ user: enrichUser(user) });
});

router.post('/:id/archive', requirePermission('delete_user'), async (req, res) => {
  const actor = req.user;
  const target = await getUserByIdRepo(req.params.id);
  if (!target) return res.status(404).json({ message: 'المستخدم غير موجود' });
  const scopedIds = new Set((await getScopedUsersForUserRepo(actor)).map((item) => item.id));
  if (actor.roleId !== 1 && !scopedIds.has(target.id)) {
    return res.status(403).json({ message: 'لا يمكنك أرشفة هذا المستخدم خارج نطاقك' });
  }
  const user = await archiveUserRepo(req.params.id, actor?.name || 'System Owner');
  return res.json({ user: enrichUser(user) });
});

router.post('/:id/transfer', requirePermission('edit_user'), async (req, res) => {
  const actor = req.user;
  const target = await getUserByIdRepo(req.params.id);
  if (!target) return res.status(404).json({ message: 'المستخدم غير موجود' });
  const scopedIds = new Set((await getScopedUsersForUserRepo(actor)).map((item) => item.id));
  if (actor.roleId !== 1 && !scopedIds.has(target.id)) {
    return res.status(403).json({ message: 'لا يمكنك نقل هذا المستخدم خارج نطاقك' });
  }
  const payload = req.body || {};
  if (!payload.projectId) {
    return res.status(400).json({ message: 'المشروع الجديد إجباري' });
  }
  if (payload.packageId) {
    const pkg = getPackageById(payload.packageId);
    if (!pkg || pkg.projectId !== Number(payload.projectId)) {
      return res.status(400).json({ message: 'البكج لا يتبع للمشروع المختار' });
    }
  }
  const user = await transferUserRepo(req.params.id, payload, actor?.name || 'System Owner');
  return res.json({ user: enrichUser(user) });
});

export default router;
