import { hashPassword, sha256, getRefreshExpiryDate } from '../utils/security.js';

function seedUser(user) {
  const passwordHash = hashPassword(user.password);
  return { ...user, passwordHash, password: undefined, failedAttempts: user.failedAttempts || 0, isLocked: false, lockedUntil: null, mustChangePassword: false, lastLoginAt: null, lastLoginIp: null };
}

export const db = {
  roles: [
    { id: 1, name: 'System Owner' },
    { id: 2, name: 'HR Manager' },
    { id: 3, name: 'HR' },
    { id: 4, name: 'Engineer' },
    { id: 5, name: 'Supervisor' },
    { id: 6, name: 'Employee' },
    { id: 7, name: 'CM' },
    { id: 8, name: 'Project Manager' }
  ],
  users: [
    seedUser({
      id: 1,
      username: 'owner',
      password: 'owner123',
      name: 'Waleed',
      gasId: '9001',
      nationalityType: 'SYSTEM',
      division: 'Full System',
      jobTitle: 'System Owner',
      roleId: 1,
      projectId: null,
      packageId: null,
      accessScope: 'Full System',
      status: 'active',
      permissions: ['*', 'lock_month', 'unlock_month', 'manage_leave_types', 'manage_leave_balances'],
      allowDuringMaintenance: true,
      failedAttempts: 0
    }),
    seedUser({
      id: 2,
      username: 'hrmanager',
      password: 'hr123',
      name: 'Saudi HR Manager',
      gasId: '1001',
      nationalityType: 'SAUDI',
      division: 'Saudi Division',
      jobTitle: 'HR Manager',
      roleId: 2,
      projectId: 1,
      packageId: 1,
      accessScope: 'Project Only',
      status: 'active',
      permissions: ['view_users', 'create_user', 'edit_user', 'edit_attendance', 'export_excel', 'lock_month', 'unlock_month', 'manage_leave_types', 'manage_leave_balances'],
      allowDuringMaintenance: false,
      failedAttempts: 0
    }),
    seedUser({
      id: 3,
      username: 'engineer',
      password: 'eng123',
      name: 'Site Engineer',
      gasId: '2002',
      nationalityType: 'NON-SAUDI',
      division: 'Non-Saudi Division',
      jobTitle: 'Engineer',
      roleId: 4,
      projectId: 1,
      packageId: 2,
      accessScope: 'Package Only',
      status: 'active',
      permissions: ['view_users', 'create_user', 'upload_attendance', 'request_attendance_edit', 'export_excel'],
      allowDuringMaintenance: false,
      failedAttempts: 0
    }),
    seedUser({
      id: 4,
      username: 'pmzuluf',
      password: 'pm123',
      name: 'Zuluf Project Manager',
      gasId: '4001',
      nationalityType: 'NON-SAUDI',
      division: 'Non-Saudi Division',
      jobTitle: 'Project Manager',
      roleId: 8,
      projectId: 1,
      packageId: null,
      accessScope: 'Project Only',
      status: 'active',
      permissions: ['approve_attendance', 'export_excel'],
      allowDuringMaintenance: false,
      failedAttempts: 0
    }),
    seedUser({
      id: 5,
      username: 'cmzuluf',
      password: 'cm123',
      name: 'Zuluf CM',
      gasId: '4002',
      nationalityType: 'NON-SAUDI',
      division: 'Non-Saudi Division',
      jobTitle: 'CM',
      roleId: 7,
      projectId: 1,
      packageId: null,
      accessScope: 'Project Only',
      status: 'active',
      permissions: ['approve_attendance', 'export_excel'],
      allowDuringMaintenance: false,
      failedAttempts: 0
    }),
    seedUser({
      id: 6,
      username: 'employee',
      password: 'emp123',
      name: 'Employee Demo',
      gasId: '2036',
      nationalityType: 'SAUDI',
      division: 'Saudi Division',
      jobTitle: 'Employee',
      roleId: 6,
      projectId: 1,
      packageId: 1,
      accessScope: 'Self Only',
      status: 'active',
      permissions: ['view_attendance', 'create_leave_request'],
      allowDuringMaintenance: false,
      failedAttempts: 0
    })
  ],
  projects: [
    { id: 1, name: 'Zuluf', status: 'active', projectManagerUserId: 4, cmUserId: 5 },
    { id: 2, name: 'Qatif', status: 'active', projectManagerUserId: null, cmUserId: null }
  ],
  packages: [
    { id: 1, projectId: 1, name: 'Admin', status: 'active' },
    { id: 2, projectId: 1, name: 'Package A', status: 'active' },
    { id: 3, projectId: 2, name: 'Package B', status: 'active' }
  ],
  employees: [
    { id: 1, gasId: '2036', name: 'AL BISHI, MUTEB M', nationality: 'SAUDI', projectId: 1, packageId: 1 },
    { id: 2, gasId: '2038', name: 'AL KHALDI, EID RASHED', nationality: 'SAUDI', projectId: 1, packageId: 1 },
    { id: 3, gasId: '3001', name: 'AHMED KHAN', nationality: 'NON-SAUDI', projectId: 1, packageId: 2 }
  ],
  attendanceUploads: [],
  attendanceRecords: [],
  attendanceAdjustments: [],
  leaveRequests: [],
  leavePolicies: [
    { code: 'annual_leave', label: 'Annual Leave', defaultDays: 30, requiresAttachment: false, deductFromBalance: true, active: true },
    { code: 'sick_leave', label: 'Sick Leave', defaultDays: 15, requiresAttachment: true, deductFromBalance: false, active: true },
    { code: 'emergency_leave', label: 'Emergency Leave', defaultDays: 5, requiresAttachment: false, deductFromBalance: true, active: true },
    { code: 'hajj_leave', label: 'Hajj Leave', defaultDays: 10, requiresAttachment: true, deductFromBalance: false, active: true },
    { code: 'umrah_leave', label: 'Umrah Leave', defaultDays: 7, requiresAttachment: true, deductFromBalance: false, active: true }
  ],
  leaveBalances: [
    { employeeId: 1, annualLeaveTotal: 30, annualLeaveUsed: 2, emergencyLeaveTotal: 5, emergencyLeaveUsed: 0, sickLeaveTotal: 15, sickLeaveUsed: 1 },
    { employeeId: 2, annualLeaveTotal: 30, annualLeaveUsed: 0, emergencyLeaveTotal: 5, emergencyLeaveUsed: 0, sickLeaveTotal: 15, sickLeaveUsed: 0 },
    { employeeId: 3, annualLeaveTotal: 30, annualLeaveUsed: 4, emergencyLeaveTotal: 5, emergencyLeaveUsed: 1, sickLeaveTotal: 15, sickLeaveUsed: 0 }
  ],
  closedAttendanceMonths: [],
  notifications: [
    {
      id: 1,
      userId: 1,
      type: 'system',
      message: 'Welcome to the HR Portal starter.',
      link: '/',
      metadata: {},
      isRead: false,
      createdAt: new Date().toISOString()
    })
  ],
  auditLogs: [],
  loginAttempts: [],
  refreshTokens: [],
  securityEvents: [],
  settings: {
    maintenanceMode: false,
    workHourPolicies: [
      { id: 1, label: 'Saudi Division Default', division: 'Saudi Division', nationality: 'SAUDI', projectId: null, packageId: null, expectedHours: 8, active: true },
      { id: 2, label: 'Non-Saudi Division Default', division: 'Non-Saudi Division', nationality: 'NON-SAUDI', projectId: null, packageId: null, expectedHours: 10, active: true }
    ]
  }
};

export function getRoleById(roleId) {
  return db.roles.find((role) => role.id === Number(roleId));
}

export function getUserByUsername(username) {
  return db.users.find((user) => user.username === username);
}


export function getUserById(userId) {
  return db.users.find((user) => user.id === Number(userId));
}

export function getEmployeeByGasId(gasId) {
  return db.employees.find((e) => String(e.gasId).trim() === String(gasId).trim());
}

export function getProjectById(projectId) {
  return db.projects.find((project) => project.id === Number(projectId));
}

export function getPackageById(packageId) {
  return db.packages.find((pkg) => pkg.id === Number(packageId));
}

export function getPackagesByProjectId(projectId) {
  return db.packages.filter((pkg) => pkg.projectId === Number(projectId));
}

export function addAuditLog(action, actorName, details = {}) {
  const item = { id: db.auditLogs.length + 1, action, actorName, details, createdAt: new Date().toISOString() };
  db.auditLogs.unshift(item);
  import('./securityRepository.js').then((m) => m.addAuditLogRepo(action, actorName, details)).catch(() => {});
}

export function createNotification(userId, message, type = 'general', link = '/', metadata = {}) {
  if (!userId) return null;
  const item = {
    id: db.notifications.length + 1,
    userId: Number(userId),
    type,
    message,
    link,
    metadata,
    isRead: false,
    createdAt: new Date().toISOString()
  };
  db.notifications.unshift(item);
  return item;
}

export function listNotificationsForUser(userId) {
  return db.notifications
    .filter((item) => item.userId === Number(userId))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function getUnreadNotificationsCount(userId) {
  return listNotificationsForUser(userId).filter((item) => !item.isRead).length;
}

export function markNotificationRead(notificationId, userId) {
  const item = db.notifications.find(
    (notification) => notification.id === Number(notificationId) && notification.userId === Number(userId)
  );
  if (!item) return null;
  item.isRead = true;
  return item;
}

export function markAllNotificationsRead(userId) {
  let updated = 0;
  db.notifications.forEach((item) => {
    if (item.userId === Number(userId) && !item.isRead) {
      item.isRead = true;
      updated += 1;
    }
  });
  return updated;
}



export function getScopedEmployeesForUser(user) {
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


export function getMonthKey(month, year) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function isAttendanceMonthClosed(month, year) {
  return db.closedAttendanceMonths.some((item) => item.key === getMonthKey(month, year) && item.closed);
}

export function closeAttendanceMonth({ month, year, actorId = null, actorName = 'System Owner', note = '' }) {
  const key = getMonthKey(month, year);
  const existing = db.closedAttendanceMonths.find((item) => item.key === key);
  if (existing) {
    existing.closed = true;
    existing.closedAt = new Date().toISOString();
    existing.closedById = actorId;
    existing.closedByName = actorName;
    existing.note = note;
  } else {
    db.closedAttendanceMonths.unshift({ key, month: Number(month), year: Number(year), closed: true, closedAt: new Date().toISOString(), closedById: actorId, closedByName: actorName, note });
  }
  addAuditLog('ATTENDANCE_MONTH_CLOSED', actorName, { key, note });
  return db.closedAttendanceMonths.find((item) => item.key === key);
}

export function openAttendanceMonth({ month, year, actorId = null, actorName = 'System Owner' }) {
  const key = getMonthKey(month, year);
  const existing = db.closedAttendanceMonths.find((item) => item.key === key);
  if (existing) {
    existing.closed = false;
    existing.reopenedAt = new Date().toISOString();
    existing.reopenedById = actorId;
    existing.reopenedByName = actorName;
  } else {
    db.closedAttendanceMonths.unshift({ key, month: Number(month), year: Number(year), closed: false, reopenedAt: new Date().toISOString(), reopenedById: actorId, reopenedByName: actorName, note: '' });
  }
  addAuditLog('ATTENDANCE_MONTH_OPENED', actorName, { key });
  return db.closedAttendanceMonths.find((item) => item.key === key);
}

export function listClosedAttendanceMonths() {
  return [...db.closedAttendanceMonths].sort((a,b)=> b.key.localeCompare(a.key));
}

export function listLeavePolicies() {
  return [...db.leavePolicies];
}

export function updateLeavePolicy(code, payload, actorName = 'System Owner') {
  const item = db.leavePolicies.find((p) => p.code === code);
  if (!item) return null;
  Object.assign(item, {
    label: payload.label ?? item.label,
    defaultDays: payload.defaultDays !== undefined ? Number(payload.defaultDays) : item.defaultDays,
    requiresAttachment: payload.requiresAttachment !== undefined ? Boolean(payload.requiresAttachment) : item.requiresAttachment,
    deductFromBalance: payload.deductFromBalance !== undefined ? Boolean(payload.deductFromBalance) : item.deductFromBalance,
    active: payload.active !== undefined ? Boolean(payload.active) : item.active
  });
  addAuditLog('LEAVE_POLICY_UPDATED', actorName, { code, policy: item });
  return item;
}

export function getLeaveBalanceForEmployee(employeeId) {
  let balance = db.leaveBalances.find((item) => item.employeeId === Number(employeeId));
  if (!balance) {
    balance = { employeeId: Number(employeeId), annualLeaveTotal: 30, annualLeaveUsed: 0, emergencyLeaveTotal: 5, emergencyLeaveUsed: 0, sickLeaveTotal: 15, sickLeaveUsed: 0 };
    db.leaveBalances.push(balance);
  }
  return balance;
}

export function listScopedLeaveBalances(user) {
  const employeeIds = new Set(getScopedEmployeesForUser(user).map((e) => e.id));
  return db.leaveBalances.filter((item) => employeeIds.has(item.employeeId)).map((item) => ({
    ...item,
    annualLeaveRemaining: Math.max(0, Number(item.annualLeaveTotal || 0) - Number(item.annualLeaveUsed || 0)),
    emergencyLeaveRemaining: Math.max(0, Number(item.emergencyLeaveTotal || 0) - Number(item.emergencyLeaveUsed || 0)),
    sickLeaveRemaining: Math.max(0, Number(item.sickLeaveTotal || 0) - Number(item.sickLeaveUsed || 0))
  }));
}

export function updateLeaveBalance(employeeId, payload, actorName = 'System Owner') {
  const item = getLeaveBalanceForEmployee(employeeId);
  Object.assign(item, {
    annualLeaveTotal: payload.annualLeaveTotal !== undefined ? Number(payload.annualLeaveTotal) : item.annualLeaveTotal,
    annualLeaveUsed: payload.annualLeaveUsed !== undefined ? Number(payload.annualLeaveUsed) : item.annualLeaveUsed,
    emergencyLeaveTotal: payload.emergencyLeaveTotal !== undefined ? Number(payload.emergencyLeaveTotal) : item.emergencyLeaveTotal,
    emergencyLeaveUsed: payload.emergencyLeaveUsed !== undefined ? Number(payload.emergencyLeaveUsed) : item.emergencyLeaveUsed,
    sickLeaveTotal: payload.sickLeaveTotal !== undefined ? Number(payload.sickLeaveTotal) : item.sickLeaveTotal,
    sickLeaveUsed: payload.sickLeaveUsed !== undefined ? Number(payload.sickLeaveUsed) : item.sickLeaveUsed,
  });
  addAuditLog('LEAVE_BALANCE_UPDATED', actorName, { employeeId, balance: item });
  return item;
}

export function applyLeaveBalanceUsage(leaveRequest, actorName = 'System') {
  const start = new Date(leaveRequest.startDate);
  const end = new Date(leaveRequest.endDate);
  const days = Math.max(1, Math.floor((end - start) / 86400000) + 1);
  const balance = getLeaveBalanceForEmployee(leaveRequest.employeeId);
  if (leaveRequest.type === 'Annual Leave') balance.annualLeaveUsed += days;
  if (leaveRequest.type === 'Emergency Leave') balance.emergencyLeaveUsed += days;
  if (leaveRequest.type === 'Sick Leave') balance.sickLeaveUsed += days;
  addAuditLog('LEAVE_BALANCE_APPLIED', actorName, { employeeId: leaveRequest.employeeId, type: leaveRequest.type, days });
  return balance;
}

export function getDefaultApproverForEmployee(employee) {
  if (!employee) return null;
  const project = getProjectById(employee.projectId);
  if (!project) return null;
  return project.projectManagerUserId || project.cmUserId || null;
}

export function createLeaveRequest(payload, actorName = 'System') {
  const employee = db.employees.find((e) => e.id === Number(payload.employeeId));
  const approverUserId = payload.approverUserId ? Number(payload.approverUserId) : getDefaultApproverForEmployee(employee);
  const item = {
    id: db.leaveRequests.length + 1,
    employeeId: Number(payload.employeeId),
    employeeName: employee?.name || payload.employeeName || '-',
    employeeGasId: employee?.gasId || payload.employeeGasId || '-',
    projectId: employee?.projectId || null,
    packageId: employee?.packageId || null,
    type: payload.type,
    startDate: payload.startDate,
    endDate: payload.endDate,
    note: payload.note || '',
    category: payload.category || 'leave',
    currentBank: payload.currentBank || '',
    newBank: payload.newBank || '',
    newIban: payload.newIban || '',
    attachmentName: payload.attachmentName || null,
    attachmentPath: payload.attachmentPath || null,
    requestedById: Number(payload.requestedById),
    requestedByName: payload.requestedByName || actorName,
    approverUserId,
    status: 'pending',
    reviewerId: null,
    reviewerName: null,
    rejectionReason: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  db.leaveRequests.unshift(item);
  addAuditLog('CREATE_LEAVE_REQUEST', actorName, { requestId: item.id, employeeId: item.employeeId, type: item.type });
  return item;
}

export function reviewLeaveRequest(requestId, payload, actorName = 'System') {
  const item = db.leaveRequests.find((r) => r.id === Number(requestId));
  if (!item) return null;
  item.status = payload.decision;
  item.reviewerId = Number(payload.reviewerId);
  item.reviewerName = payload.reviewerName || actorName;
  item.rejectionReason = payload.rejectionReason || '';
  item.updatedAt = new Date().toISOString();
  addAuditLog('REVIEW_LEAVE_REQUEST', actorName, { requestId: item.id, decision: item.status });
  if (item.status === 'approved') {
    applyApprovedLeaveToAttendance(item, actorName);
    applyLeaveBalanceUsage(item, actorName);
  }
  return item;
}

export function listScopedLeaveRequests(user) {
  if (!user) return [];
  if (user.roleId === 1) return [...db.leaveRequests];
  const employees = getScopedEmployeesForUser(user);
  const employeeIds = new Set(employees.map((e) => e.id));
  let rows = db.leaveRequests.filter((r) => employeeIds.has(r.employeeId));
  if (['Engineer', 'Supervisor', 'Employee'].includes(user.jobTitle)) {
    rows = rows.filter((r) => Number(r.requestedById) === Number(user.id) || Number(r.approverUserId) === Number(user.id));
  }
  if (['Project Manager', 'CM', 'HR Manager', 'HR'].includes(user.jobTitle)) {
    rows = rows.filter((r) => Number(r.approverUserId) === Number(user.id) || employeeIds.has(r.employeeId));
  }
  return rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}


export function applyApprovedLeaveToAttendance(leaveRequest, actorName = 'System') {
  if (!leaveRequest || leaveRequest.status !== 'approved') return [];
  const typeToStatus = {
    'Annual Leave': 'Annual Leave',
    'Sick Leave': 'Sick Leave',
    'Emergency Leave': 'Emergency Leave',
    'Hajj Leave': 'Hajj',
    'Umrah Leave': 'Umrah',
    'Business Trip': 'Business Trip',
    'Task Assignment': 'Training'
  };
  const attendanceStatus = typeToStatus[leaveRequest.type];
  if (!attendanceStatus) return [];
  const start = new Date(leaveRequest.startDate);
  const end = new Date(leaveRequest.endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error('تواريخ الطلب غير صالحة');
  }
  const updated = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const date = cursor.toISOString().slice(0,10);
    const record = upsertAttendanceRecord({
      employeeId: Number(leaveRequest.employeeId),
      date,
      hours: 0,
      status: attendanceStatus,
      source: 'request-approved',
      isModified: true,
      note: `${leaveRequest.type} approved request #${leaveRequest.id}`
    });
    updated.push(record);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  addAuditLog('APPLY_APPROVED_LEAVE_TO_ATTENDANCE', actorName, {
    requestId: leaveRequest.id,
    employeeId: leaveRequest.employeeId,
    type: leaveRequest.type,
    startDate: leaveRequest.startDate,
    endDate: leaveRequest.endDate,
    affectedDays: updated.length
  });
  return updated;
}


export function listWorkHourPolicies() {
  return [...(db.settings.workHourPolicies || [])].sort((a, b) => Number(a.id) - Number(b.id));
}

export function getExpectedWorkHoursForEmployee(employee) {
  const policies = listWorkHourPolicies().filter((item) => item.active !== false);
  const exactPackage = policies.find((item) => item.projectId === Number(employee.projectId) && item.packageId === Number(employee.packageId));
  if (exactPackage) return Number(exactPackage.expectedHours || 0);
  const projectPolicy = policies.find((item) => item.projectId === Number(employee.projectId) && (item.packageId === null || item.packageId === undefined));
  if (projectPolicy) return Number(projectPolicy.expectedHours || 0);
  const divisionPolicy = policies.find((item) => item.division === (employee.nationality === 'SAUDI' ? 'Saudi Division' : 'Non-Saudi Division') && !item.projectId && !item.packageId);
  if (divisionPolicy) return Number(divisionPolicy.expectedHours || 0);
  return employee.nationality === 'SAUDI' ? 8 : 10;
}

export function upsertWorkHourPolicy(payload, actorName = 'System Owner') {
  const list = db.settings.workHourPolicies || (db.settings.workHourPolicies = []);
  const id = payload.id ? Number(payload.id) : null;
  let item = id ? list.find((row) => row.id === id) : null;
  const base = {
    label: payload.label || 'Work Hour Policy',
    division: payload.division || null,
    nationality: payload.nationality || null,
    projectId: payload.projectId !== undefined && payload.projectId !== null && payload.projectId !== '' ? Number(payload.projectId) : null,
    packageId: payload.packageId !== undefined && payload.packageId !== null && payload.packageId !== '' ? Number(payload.packageId) : null,
    expectedHours: Number(payload.expectedHours || 0),
    active: payload.active !== undefined ? Boolean(payload.active) : true
  };
  if (!item) {
    item = { id: list.length ? Math.max(...list.map((row) => row.id)) + 1 : 1, ...base };
    list.push(item);
    addAuditLog('WORK_HOUR_POLICY_CREATED', actorName, { policy: item });
  } else {
    Object.assign(item, base);
    addAuditLog('WORK_HOUR_POLICY_UPDATED', actorName, { policy: item });
  }
  return item;
}

export function deleteWorkHourPolicy(id, actorName = 'System Owner') {
  const list = db.settings.workHourPolicies || [];
  const index = list.findIndex((row) => row.id === Number(id));
  if (index < 0) return null;
  const [removed] = list.splice(index, 1);
  addAuditLog('WORK_HOUR_POLICY_DELETED', actorName, { policy: removed });
  return removed;
}

export function createUser(payload, actorName = 'System') {
  const role = getRoleById(payload.roleId);
  const project = payload.projectId ? getProjectById(payload.projectId) : null;
  const pkg = payload.packageId ? getPackageById(payload.packageId) : null;
  const user = {
    id: db.users.length + 1,
    username: payload.username,
    password: undefined,
    passwordHash: payload.passwordHash,
    name: payload.name,
    gasId: payload.gasId,
    nationalityType: payload.nationalityType,
    division: payload.division,
    jobTitle: payload.jobTitle,
    roleId: Number(payload.roleId),
    roleName: role?.name || payload.roleName,
    projectId: payload.projectId ? Number(payload.projectId) : null,
    packageId: payload.packageId ? Number(payload.packageId) : null,
    accessScope: payload.accessScope,
    status: payload.status || 'active',
    permissions: payload.permissions || [],
    allowDuringMaintenance: Boolean(payload.allowDuringMaintenance),
    failedAttempts: 0,
    createdAt: new Date().toISOString()
  };
  db.users.push(user);
  addAuditLog('user_created', actorName, {
    name: user.name,
    gasId: user.gasId,
    role: role?.name,
    project: project?.name || 'All Projects',
    package: pkg?.name || 'All Packages'
  });
  return user;
}


export function updateUser(userId, payload, actorName = 'System') {
  const user = getUserById(userId);
  if (!user) return null;

  const role = payload.roleId ? getRoleById(payload.roleId) : getRoleById(user.roleId);
  const project = payload.projectId ? getProjectById(payload.projectId) : (user.projectId ? getProjectById(user.projectId) : null);
  const pkg = payload.packageId ? getPackageById(payload.packageId) : (user.packageId ? getPackageById(user.packageId) : null);

  const before = {
    name: user.name,
    username: user.username,
    gasId: user.gasId,
    jobTitle: user.jobTitle,
    roleId: user.roleId,
    division: user.division,
    projectId: user.projectId,
    packageId: user.packageId,
    accessScope: user.accessScope,
    status: user.status,
    permissions: [...(user.permissions || [])],
    allowDuringMaintenance: Boolean(user.allowDuringMaintenance),
    mustChangePassword: Boolean(user.mustChangePassword)
  };

  user.name = payload.name ?? user.name;
  user.username = payload.username ?? user.username;
  user.gasId = payload.gasId ?? user.gasId;
  user.nationalityType = payload.nationalityType ?? user.nationalityType;
  user.division = payload.division ?? user.division;
  user.jobTitle = payload.jobTitle ?? user.jobTitle;
  user.roleId = payload.roleId ? Number(payload.roleId) : user.roleId;
  user.roleName = role?.name || user.roleName;
  user.projectId = payload.projectId === null ? null : (payload.projectId ? Number(payload.projectId) : user.projectId);
  user.packageId = payload.packageId === null ? null : (payload.packageId ? Number(payload.packageId) : user.packageId);
  user.supervisorId = payload.supervisorId === null ? null : (payload.supervisorId ? Number(payload.supervisorId) : user.supervisorId);
  user.accessScope = payload.accessScope ?? user.accessScope;
  user.permissions = payload.permissions || user.permissions || [];
  user.allowDuringMaintenance = payload.allowDuringMaintenance !== undefined ? Boolean(payload.allowDuringMaintenance) : Boolean(user.allowDuringMaintenance);
  user.mustChangePassword = payload.forcePasswordChange !== undefined ? Boolean(payload.forcePasswordChange) : Boolean(user.mustChangePassword);

  if (payload.passwordHash) {
    user.passwordHash = payload.passwordHash;
    addSecurityEvent('password_reset', user.id, { by: actorName });
  }

  if (payload.status) {
    user.status = payload.status;
    if (payload.status === 'locked') {
      user.isLocked = true;
      addSecurityEvent('account_locked_by_admin', user.id, { by: actorName });
    } else if (user.isLocked) {
      user.isLocked = false;
      user.failedAttempts = 0;
      user.lockedUntil = null;
    }
  }

  user.updatedAt = new Date().toISOString();
  addAuditLog('user_updated', actorName, {
    userId: user.id,
    before,
    after: {
      name: user.name,
      username: user.username,
      gasId: user.gasId,
      jobTitle: user.jobTitle,
      role: role?.name || user.roleName,
      division: user.division,
      project: project?.name || 'All Projects',
      package: pkg?.name || 'All Packages',
      accessScope: user.accessScope,
      status: user.status,
      permissions: user.permissions,
      allowDuringMaintenance: user.allowDuringMaintenance,
      mustChangePassword: user.mustChangePassword
    }
  });

  return user;
}

export function createProject(payload, actorName = 'System') {
  const project = {
    id: db.projects.length + 1,
    name: payload.name,
    status: payload.status || 'active',
    projectManagerUserId: payload.projectManagerUserId ? Number(payload.projectManagerUserId) : null,
    cmUserId: payload.cmUserId ? Number(payload.cmUserId) : null,
    createdAt: new Date().toISOString()
  };
  db.projects.push(project);
  addAuditLog('project_created', actorName, { name: project.name });
  return project;
}

export function createPackage(payload, actorName = 'System') {
  const pkg = {
    id: db.packages.length + 1,
    name: payload.name,
    projectId: Number(payload.projectId),
    status: payload.status || 'active',
    createdAt: new Date().toISOString()
  };
  db.packages.push(pkg);
  addAuditLog('package_created', actorName, {
    name: pkg.name,
    projectId: pkg.projectId
  });
  return pkg;
}

export function upsertAttendanceRecord(record) {
  const existing = db.attendanceRecords.find(
    (r) => r.employeeId === record.employeeId && r.date === record.date
  );

  if (existing) {
    Object.assign(existing, record, { updatedAt: new Date().toISOString() });
    return existing;
  }

  const newRecord = {
    id: db.attendanceRecords.length + 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...record
  };
  db.attendanceRecords.push(newRecord);
  return newRecord;
}


export function getScopedUsersForUser(user) {
  if (!user) return [];
  if (user.roleId === 1) return db.users;
  let users = db.users.filter((u) => u.id !== 1);
  if (user.division === 'Saudi Division') {
    users = users.filter((u) => u.division === 'Saudi Division');
  } else if (user.division === 'Non-Saudi Division') {
    users = users.filter((u) => u.division === 'Non-Saudi Division');
  }
  if (user.accessScope === 'Package Only') {
    users = users.filter((u) => u.projectId === user.projectId && u.packageId === user.packageId);
  } else if (user.accessScope === 'Project Only') {
    users = users.filter((u) => u.projectId === user.projectId);
  }
  return users;
}

export function listLockedUsers() {
  return db.users.filter((u) => u.status === 'locked' || u.isLocked);
}

export function unlockUser(userId, actorName = 'System Owner') {
  const user = getUserById(userId);
  if (!user) return null;
  user.status = 'active';
  user.failedAttempts = 0;
  user.isLocked = false;
  user.lockedUntil = null;
  addAuditLog('UNLOCK_USER', actorName, { userId: user.id, username: user.username });
  addSecurityEvent('account_unlocked', user.id, { by: actorName });
  return user;
}

export function addLoginAttempt({ username, ipAddress, userAgent, status }) {
  const item = { id: db.loginAttempts.length + 1, username, ipAddress, userAgent, status, createdAt: new Date().toISOString() };
  db.loginAttempts.unshift(item);
  import('./securityRepository.js').then((m) => m.addLoginAttemptRepo({ username, ipAddress, userAgent, status })).catch(() => {});
}

export function addSecurityEvent(eventType, userId, details = {}, ipAddress = '-') {
  const item = { id: db.securityEvents.length + 1, userId, eventType, details, ipAddress, createdAt: new Date().toISOString() };
  db.securityEvents.unshift(item);
  import('./securityRepository.js').then((m) => m.addSecurityEventRepo(eventType, userId, details, ipAddress)).catch(() => {});
}

export function storeRefreshToken(userId, rawToken) {
  const item = { id: db.refreshTokens.length + 1, userId: Number(userId), tokenHash: sha256(rawToken), expiresAt: getRefreshExpiryDate(), revokedAt: null, createdAt: new Date().toISOString() };
  db.refreshTokens.unshift(item);
  import('./securityRepository.js').then((m) => m.storeRefreshTokenRepo(userId, rawToken)).catch(() => {});
  return item;
}

export function revokeRefreshToken(rawToken) {
  const hashed = sha256(rawToken);
  const item = db.refreshTokens.find((token) => token.tokenHash === hashed && !token.revokedAt);
  if (item) item.revokedAt = new Date().toISOString();
  import('./securityRepository.js').then((m) => m.revokeRefreshTokenRepo(rawToken)).catch(() => {});
  return item;
}

export function findValidRefreshToken(rawToken) {
  const hashed = sha256(rawToken);
  return db.refreshTokens.find((token) => token.tokenHash === hashed && !token.revokedAt && new Date(token.expiresAt) > new Date());
}


export function archiveUser(userId, actorName = "System") {
  const user = getUserById(userId);
  if (!user) return null;
  user.status = 'archived';
  user.isLocked = false;
  user.failedAttempts = 0;
  user.updatedAt = new Date().toISOString();
  addAuditLog('user_archived', actorName, { userId: user.id, name: user.name });
  addSecurityEvent('account_archived', user.id, { by: actorName });
  return user;
}

export function resetUserPassword(userId, passwordHash, actorName = 'System Owner') {
  const user = getUserById(userId);
  if (!user) return null;
  user.passwordHash = passwordHash;
  user.mustChangePassword = true;
  user.updatedAt = new Date().toISOString();
  addAuditLog('user_password_reset', actorName, { userId: user.id, name: user.name });
  addSecurityEvent('password_reset', user.id, { by: actorName });
  return user;
}

export function transferUser(userId, payload, actorName = 'System') {
  const user = getUserById(userId);
  if (!user) return null;
  const before = { projectId: user.projectId, packageId: user.packageId, division: user.division, accessScope: user.accessScope };
  user.projectId = payload.projectId ? Number(payload.projectId) : null;
  user.packageId = payload.packageId ? Number(payload.packageId) : null;
  user.division = payload.division ?? user.division;
  user.accessScope = payload.accessScope ?? user.accessScope;
  user.updatedAt = new Date().toISOString();
  addAuditLog('user_transferred', actorName, {
    userId: user.id,
    before,
    after: { projectId: user.projectId, packageId: user.packageId, division: user.division, accessScope: user.accessScope }
  });
  return user;
}
