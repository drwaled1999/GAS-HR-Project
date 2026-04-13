import { authenticateToken, enforceMaintenance } from '../middleware_auth.js';
import { Router } from 'express';
import { db } from '../data/index.js';

const router = Router();
router.use(authenticateToken, enforceMaintenance);

function getScopedEmployees(user) {
  if (!user) return [];
  if (user.roleId === 1) return db.employees;

  let employees = [...db.employees];

  if (user.division === 'Saudi Division') {
    employees = employees.filter((e) => e.nationality === 'SAUDI');
  } else if (user.division === 'Non-Saudi Division') {
    employees = employees.filter((e) => e.nationality !== 'SAUDI');
  }

  if (user.accessScope === 'Package Only') {
    employees = employees.filter((e) => e.projectId === user.projectId && e.packageId === user.packageId);
  } else if (user.accessScope === 'Project Only') {
    employees = employees.filter((e) => e.projectId === user.projectId);
  }

  return employees;
}

function getScopedRequests(user, employees) {
  const employeeIds = new Set(employees.map((e) => e.id));
  let requests = db.attendanceAdjustments.filter((r) => employeeIds.has(r.employeeId));

  if (['Engineer', 'Supervisor'].includes(user?.jobTitle)) {
    requests = requests.filter((r) => Number(r.requestedById) === Number(user.id));
  }

  return requests;
}

function buildTodaySummary(employees) {
  const today = new Date().toISOString().slice(0, 10);
  const employeeIds = new Set(employees.map((e) => e.id));
  const records = db.attendanceRecords.filter((r) => employeeIds.has(r.employeeId) && r.date === today);

  const present = records.filter((r) => Number(r.hours || 0) > 0).length;
  const singlePunch = records.filter((r) => r.status === 'Single Punch').length;
  const absent = employees.length - records.filter((r) => r.status !== 'Weekend' && r.status !== 'Official Holiday').length;

  return {
    date: today,
    present: Math.max(present, 0),
    absent: Math.max(absent, 0),
    singlePunch
  };
}

function buildRecentActivity(user, employees, requests) {
  const employeeIds = new Set(employees.map((e) => e.id));
  const visibleLogs = db.auditLogs.slice(0, 20);
  const visibleRequests = requests.slice(0, 5).map((item) => ({
    id: item.id,
    type: 'request',
    title: `${item.employeeName || item.employeeId} → ${item.newStatus}`,
    subtitle: item.reason || 'Attendance adjustment request',
    status: item.status,
    createdAt: item.createdAt
  }));

  const visibleAttendance = db.attendanceRecords
    .filter((r) => employeeIds.has(r.employeeId) && r.isModified)
    .slice(-5)
    .reverse()
    .map((item) => {
      const employee = employees.find((e) => e.id === item.employeeId);
      return {
        id: `att-${item.id}`,
        type: 'attendance',
        title: `${employee?.name || item.employeeId} • ${item.date}`,
        subtitle: item.status || `${item.hours || 0} Hours`,
        status: item.source || 'manual',
        createdAt: item.updatedAt || item.createdAt
      };
    });

  const auditItems = user.roleId === 1
    ? visibleLogs.slice(0, 5).map((item) => ({
        id: `log-${item.id}`,
        type: 'audit',
        title: item.action,
        subtitle: item.actorName,
        status: 'logged',
        createdAt: item.createdAt
      }))
    : [];

  return [...visibleRequests, ...visibleAttendance, ...auditItems]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 6);
}

router.get('/summary', (req, res) => {
  const username = req.query.username;
  const user = getUserByUsername(username);

  if (!user) {
    return res.status(404).json({ message: 'المستخدم غير موجود' });
  }

  const employees = getScopedEmployees(user);
  const requests = getScopedRequests(user, employees);
  const today = buildTodaySummary(employees);

  const cards = [
    { label: 'Visible Employees', value: employees.length, hint: 'الموظفون ضمن نطاقك' },
    { label: 'Pending Requests', value: requests.filter((r) => r.status === 'pending').length, hint: 'طلبات تحتاج متابعة' },
    { label: 'Today Present', value: today.present, hint: `حضور اليوم ${today.date}` },
    { label: 'Single Punch', value: today.singlePunch, hint: 'سجلات ناقصة اليوم' }
  ];

  if (user.roleId === 1) {
    cards[0] = { label: 'All Employees', value: db.employees.length, hint: 'كل موظفي النظام' };
    cards.push({ label: 'Active Projects', value: db.projects.filter((p) => p.status === 'active').length, hint: 'المشاريع النشطة' });
    cards.push({ label: 'Locked Accounts', value: db.users.filter((u) => u.status === 'locked').length, hint: 'حسابات تحتاج فتح' });
  }

  if (user.jobTitle === 'HR Manager') {
    cards[0] = { label: 'Saudi Employees', value: employees.length, hint: 'السعوديون في نطاقك' };
    cards.push({ label: 'Today Absent', value: today.absent, hint: 'غياب اليوم' });
  }

  if (user.jobTitle === 'Engineer') {
    cards[0] = { label: 'Package Employees', value: employees.length, hint: 'الموظفون في البكج' };
    cards.push({ label: 'My Requests', value: requests.length, hint: 'طلبات التعديل المرسلة' });
  }

  const projects = [...new Set(employees.map((e) => e.projectId))].map((projectId) => {
    const project = db.projects.find((p) => p.id === projectId);
    const count = employees.filter((e) => e.projectId === projectId).length;
    return { id: projectId, name: project?.name || `Project ${projectId}`, employees: count };
  });

  const packages = [...new Set(employees.map((e) => e.packageId))].map((packageId) => {
    const pkg = db.packages.find((p) => p.id === packageId);
    const count = employees.filter((e) => e.packageId === packageId).length;
    return { id: packageId, name: pkg?.name || `Package ${packageId}`, employees: count };
  });

  return res.json({
    user: {
      role: user.jobTitle,
      division: user.division,
      projectId: user.projectId,
      packageId: user.packageId,
      maintenanceMode: db.settings.maintenanceMode
    },
    cards,
    today,
    projects,
    packages,
    recentActivity: buildRecentActivity(user, employees, requests)
  });
});

export default router;
