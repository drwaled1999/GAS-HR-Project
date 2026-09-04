import { Router } from 'express';
import ExcelJS from 'exceljs';
import { authenticateToken, enforceMaintenance, requireSystemOwner } from '../middleware_auth.js';
import { buildPayrollSummary } from '../services/payrollService.js';
import { createPayrollRunRepo, deletePayrollAdjustmentRepo, deleteProjectJobCompensationRepo, deleteWorkHourPolicyRepo, getPayrollRunDetailsRepo, getPayrollSlipRepo, listEmployeeCompensationRepo, listPayrollAdjustmentsRepo, listPayrollRunsRepo, listProjectJobCompensationRepo, listSalaryTransferRequestsRepo, listWorkHourPoliciesRepo, upsertEmployeeCompensationRepo, upsertPayrollAdjustmentRepo, upsertProjectJobCompensationRepo, upsertWorkHourPolicyRepo } from '../data/payrollRepository.js';
import { getScopedEmployeesForUserRepo } from '../data/userEmployeeRepository.js';

const router = Router();
router.use(authenticateToken, enforceMaintenance);
const currentPeriod = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh', year: 'numeric', month: 'numeric',
  }).formatToParts(new Date());
  return {
    month: Number(parts.find((part) => part.type === 'month')?.value),
    year: Number(parts.find((part) => part.type === 'year')?.value),
  };
};

function canViewPayroll(user) {
  if (!user) return false;
  const role = String(user.roleName || user.role || user.roleCode || '').trim().toLowerCase();
  const permissions = Array.isArray(user.permissions)
    ? user.permissions.map((item) => String(item || '').trim().toLowerCase())
    : [];
  return ['system owner', 'owner', 'system_owner'].includes(role) ||
    permissions.includes('*') || permissions.includes('payroll.view');
}

function canManagePayroll(user) {
  if (!canViewPayroll(user)) return false;
  const role = String(user.roleName || user.role || user.roleCode || '').trim().toLowerCase();
  return ['system owner', 'owner', 'system_owner', 'hr manager', 'hr_manager', 'hr admin', 'hr_admin', 'hr'].includes(role);
}

function validPeriod(month, year) {
  return Number.isInteger(month) && month >= 1 && month <= 12 &&
    Number.isInteger(year) && year >= 2024 && year <= 2100;
}

async function scopedEmployeeIds(user) {
  const employees = await getScopedEmployeesForUserRepo(user);
  return { employees, ids: new Set(employees.map((item) => String(item.id))) };
}

function runIsInScope(run, user) {
  const role = String(user?.roleName || user?.role || user?.roleCode || '').trim().toLowerCase();
  if (['system owner', 'owner', 'system_owner'].includes(role)) return true;
  if (user?.accessScope === 'Package Only') {
    return String(run.projectId || '') === String(user.projectId || '') &&
      String(run.packageId || '') === String(user.packageId || '');
  }
  if (user?.accessScope === 'Project Only') {
    return String(run.projectId || '') === String(user.projectId || '');
  }
  return !run.division || run.division === user?.division;
}

router.get('/summary', async (req, res) => {
  if (!canViewPayroll(req.user)) return res.status(403).json({ message: 'Payroll is not available for this account.' });
  const defaults = currentPeriod();
  const month = Number(req.query.month || defaults.month);
  const year = Number(req.query.year || defaults.year);
  if (!validPeriod(month, year)) return res.status(400).json({ message: 'Invalid payroll month or year.' });
  const summary = await buildPayrollSummary({ user: req.user, month, year });
  res.json({ summary, workHourPolicies: await listWorkHourPoliciesRepo() });
});

router.post('/run', async (req, res) => {
  if (!canManagePayroll(req.user)) return res.status(403).json({ message: 'You do not have permission to create payroll runs.' });
  const defaults = currentPeriod();
  const month = Number(req.body?.month || req.query.month || defaults.month);
  const year = Number(req.body?.year || req.query.year || defaults.year);
  if (!validPeriod(month, year)) return res.status(400).json({ message: 'Invalid payroll month or year.' });
  const existingRun = (await listPayrollRunsRepo()).find((run) =>
    Number(run.month) === month && Number(run.year) === year &&
    String(run.division || '') === String(req.user?.division || '') &&
    String(run.projectId || '') === String(req.user?.projectId || '') &&
    String(run.packageId || '') === String(req.user?.packageId || '')
  );
  if (existingRun) return res.status(409).json({ message: 'A payroll run already exists for this period and scope.' });
  const summary = await buildPayrollSummary({ user: req.user, month, year });
  const recordedDays = Number(summary?.totals?.presentDays || 0) +
    Number(summary?.totals?.absentDays || 0) + Number(summary?.totals?.leaveDays || 0) +
    Number(summary?.totals?.issueDays || 0);
  if (!recordedDays) return res.status(400).json({ message: 'No approved Project Attendance records were found for this period.' });
  if (Number(summary?.totals?.issueDays || 0) > 0) return res.status(400).json({ message: 'Resolve all attendance issues before creating the payroll run.' });
  const run = await createPayrollRunRepo({ user: req.user, month, year, summary });
  res.json({ run, summary });
});

router.get('/runs', async (req, res) => {
  if (!canViewPayroll(req.user)) return res.status(403).json({ message: 'Payroll is not available for this account.' });
  const runs = await listPayrollRunsRepo();
  res.json({ runs: runs.filter((run) => runIsInScope(run, req.user)) });
});

router.get('/runs/:id', async (req, res) => {
  if (!canViewPayroll(req.user)) return res.status(403).json({ message: 'Payroll is not available for this account.' });
  const details = await getPayrollRunDetailsRepo(req.params.id);
  if (!details) return res.status(404).json({ message: 'Payroll run not found.' });
  if (!runIsInScope(details.run, req.user)) return res.status(403).json({ message: 'Payroll run is outside your access scope.' });
  const { ids } = await scopedEmployeeIds(req.user);
  res.json({ ...details, items: details.items.filter((item) => ids.has(String(item.employeeId))) });
});

router.get('/salary-transfer-requests', async (req, res) => {
  if (!canManagePayroll(req.user)) return res.status(403).json({ message: 'You do not have permission to review salary transfer requests.' });
  res.json({ requests: await listSalaryTransferRequestsRepo(req.user) });
});

router.get('/export', async (req, res) => {
  if (!canViewPayroll(req.user)) return res.status(403).json({ message: 'Payroll is not available for this account.' });
  const defaults = currentPeriod();
  const month = Number(req.query.month || defaults.month);
  const year = Number(req.query.year || defaults.year);
  if (!validPeriod(month, year)) return res.status(400).json({ message: 'Invalid payroll month or year.' });
  const { rows } = await buildPayrollSummary({ user: req.user, month, year });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(`Payroll-${year}-${month}`);
  sheet.columns = [
    { header: 'Employee Name', key: 'employeeName', width: 28 },
    { header: 'GAS ID', key: 'gasId', width: 14 },
    { header: 'Nationality', key: 'nationality', width: 14 },
    { header: 'Job Title', key: 'jobTitle', width: 24 },
    { header: 'Compensation Source', key: 'compensationSource', width: 20 },
    { header: 'Project ID', key: 'projectId', width: 12 },
    { header: 'Package ID', key: 'packageId', width: 12 },
    { header: 'Daily Hours', key: 'expectedDailyHours', width: 12 },
    { header: 'Present Days', key: 'presentDays', width: 12 },
    { header: 'Absent Days', key: 'absentDays', width: 12 },
    { header: 'Leave Days', key: 'leaveDays', width: 12 },
    { header: 'Issue Days', key: 'issueDays', width: 12 },
    { header: 'Regular Hours', key: 'regularHours', width: 14 },
    { header: 'Overtime Hours', key: 'overtimeHours', width: 14 },
    { header: 'Worked Hours', key: 'totalWorkedHours', width: 14 },
    { header: 'Payable Base Hours', key: 'payableBaseHours', width: 16 },
    { header: 'Base Pay', key: 'basePay', width: 14 },
    { header: 'Overtime Pay', key: 'overtimePay', width: 14 },
    { header: 'Gross Amount', key: 'grossAmount', width: 14 },
    { header: 'Deductions', key: 'deductionsAmount', width: 14 },
    { header: 'Net Amount', key: 'netAmount', width: 14 }
  ];
  sheet.getRow(1).font = { bold: true };
  rows.forEach((row) => sheet.addRow(row));
  const buffer = await workbook.xlsx.writeBuffer();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="payroll-${year}-${month}.xlsx"`);
  res.send(Buffer.from(buffer));
});

router.get('/policies', async (req, res) => {
  if (!canViewPayroll(req.user)) return res.status(403).json({ message: 'Payroll is not available for this account.' });
  res.json({ workHourPolicies: await listWorkHourPoliciesRepo() });
});

router.post('/policies', async (req, res) => {
  if (!canManagePayroll(req.user)) return res.status(403).json({ message: 'You do not have permission to manage payroll policies.' });
  const payload = req.body || {};
  if (!String(payload.label || '').trim()) return res.status(400).json({ message: 'Policy label is required.' });
  if (!payload.expectedHours || Number(payload.expectedHours) <= 0) {
    return res.status(400).json({ message: 'Expected work hours must be greater than zero.' });
  }
  const policy = await upsertWorkHourPolicyRepo(payload, req.user?.name || 'System Owner');
  res.json({ policy, workHourPolicies: await listWorkHourPoliciesRepo() });
});

router.delete('/policies/:id', requireSystemOwner, async (req, res) => {
  const removed = await deleteWorkHourPolicyRepo(req.params.id, req.user?.name || 'System Owner');
  if (!removed) return res.status(404).json({ message: 'Policy not found.' });
  res.json({ removed, workHourPolicies: await listWorkHourPoliciesRepo() });
});


router.get('/compensation', async (req, res) => {
  if (!canViewPayroll(req.user)) return res.status(403).json({ message: 'Payroll is not available for this account.' });
  const { ids } = await scopedEmployeeIds(req.user);
  const compensation = await listEmployeeCompensationRepo();
  res.json({ compensation: compensation.filter((item) => ids.has(String(item.employeeId))) });
});

router.get('/employees', async (req, res) => {
  if (!canViewPayroll(req.user)) return res.status(403).json({ message: 'Payroll is not available for this account.' });
  const { employees } = await scopedEmployeeIds(req.user);
  res.json({ employees: employees.map((item) => ({
    id: item.id,
    name: item.name,
    gasId: item.gasId,
    nationality: item.nationality,
    projectId: item.projectId,
    packageId: item.packageId,
    projectName: item.projectName,
    packageName: item.packageName,
    jobTitle: item.jobTitle,
  })) });
});

router.get('/compensation-rules', async (req, res) => {
  if (!canViewPayroll(req.user)) return res.status(403).json({ message: 'Payroll is not available for this account.' });
  const { employees } = await scopedEmployeeIds(req.user);
  const allowedProjects = new Set(employees.map((item) => String(item.projectId || '')).filter(Boolean));
  const rules = await listProjectJobCompensationRepo();
  const isOwner = ['system owner', 'owner', 'system_owner'].includes(String(req.user?.roleName || req.user?.role || req.user?.roleCode || '').trim().toLowerCase());
  res.json({ compensationRules: isOwner ? rules : rules.filter((item) => allowedProjects.has(String(item.projectId))) });
});

router.post('/compensation-rules', async (req, res) => {
  if (!canManagePayroll(req.user)) return res.status(403).json({ message: 'You do not have permission to manage payroll compensation rules.' });
  const payload = req.body || {};
  if (!payload.projectId || !String(payload.jobTitle || '').trim()) return res.status(400).json({ message: 'Project and job title are required.' });
  const amountKeys = ['baseSalary', 'hourlyRate', 'housingAllowance', 'transportAllowance', 'otherAllowances'];
  if (amountKeys.some((key) => !Number.isFinite(Number(payload[key] || 0)) || Number(payload[key] || 0) < 0)) return res.status(400).json({ message: 'Compensation amounts cannot be negative.' });
  if (!Number.isFinite(Number(payload.overtimeMultiplier)) || Number(payload.overtimeMultiplier) < 1) return res.status(400).json({ message: 'Overtime multiplier must be at least 1.' });
  const { employees } = await scopedEmployeeIds(req.user);
  const role = String(req.user?.roleName || req.user?.role || req.user?.roleCode || '').trim().toLowerCase();
  const isOwner = ['system owner', 'owner', 'system_owner'].includes(role);
  if (!isOwner && !employees.some((item) => String(item.projectId) === String(payload.projectId))) return res.status(403).json({ message: 'Project is outside your access scope.' });
  const compensationRule = await upsertProjectJobCompensationRepo(payload, req.user?.name || 'System Owner');
  res.json({ compensationRule, compensationRules: await listProjectJobCompensationRepo() });
});

router.delete('/compensation-rules/:id', async (req, res) => {
  if (!canManagePayroll(req.user)) return res.status(403).json({ message: 'You do not have permission to delete payroll compensation rules.' });
  const rules = await listProjectJobCompensationRepo();
  const target = rules.find((item) => String(item.id) === String(req.params.id));
  if (!target) return res.status(404).json({ message: 'Compensation rule not found.' });
  const { employees } = await scopedEmployeeIds(req.user);
  const role = String(req.user?.roleName || req.user?.role || req.user?.roleCode || '').trim().toLowerCase();
  const isOwner = ['system owner', 'owner', 'system_owner'].includes(role);
  if (!isOwner && !employees.some((item) => String(item.projectId) === String(target.projectId))) return res.status(403).json({ message: 'Project is outside your access scope.' });
  res.json({ removed: await deleteProjectJobCompensationRepo(req.params.id, req.user?.name || 'System Owner') });
});

router.post('/compensation', async (req, res) => {
  if (!canManagePayroll(req.user)) return res.status(403).json({ message: 'You do not have permission to manage payroll compensation.' });
  const payload = req.body || {};
  if (!payload.employeeId) return res.status(400).json({ message: 'Employee is required.' });
  const compensationNumbers = ['baseSalary', 'hourlyRate', 'housingAllowance', 'transportAllowance', 'otherAllowances'];
  if (compensationNumbers.some((key) => !Number.isFinite(Number(payload[key] || 0)) || Number(payload[key] || 0) < 0)) {
    return res.status(400).json({ message: 'Compensation amounts cannot be negative.' });
  }
  if (!Number.isFinite(Number(payload.overtimeMultiplier)) || Number(payload.overtimeMultiplier) < 1) {
    return res.status(400).json({ message: 'Overtime multiplier must be at least 1.' });
  }
  const { ids } = await scopedEmployeeIds(req.user);
  if (!ids.has(String(payload.employeeId))) return res.status(403).json({ message: 'Employee is outside your access scope.' });
  const compensation = await upsertEmployeeCompensationRepo(payload, req.user?.name || 'System Owner');
  const compensationItems = (await listEmployeeCompensationRepo()).filter((item) => ids.has(String(item.employeeId)));
  res.json({ compensation, compensationItems });
});

router.get('/adjustments', async (req, res) => {
  if (!canViewPayroll(req.user)) return res.status(403).json({ message: 'Payroll is not available for this account.' });
  const defaults = currentPeriod();
  const month = Number(req.query.month || defaults.month);
  const year = Number(req.query.year || defaults.year);
  if (!validPeriod(month, year)) return res.status(400).json({ message: 'Invalid payroll month or year.' });
  const { ids } = await scopedEmployeeIds(req.user);
  const adjustments = await listPayrollAdjustmentsRepo({ month, year });
  res.json({ adjustments: adjustments.filter((item) => ids.has(String(item.employeeId))) });
});

router.post('/adjustments', async (req, res) => {
  if (!canManagePayroll(req.user)) return res.status(403).json({ message: 'You do not have permission to manage payroll adjustments.' });
  const payload = req.body || {};
  if (!payload.employeeId || !payload.type || !payload.label) return res.status(400).json({ message: 'Employee, type, and label are required.' });
  if (!validPeriod(Number(payload.month), Number(payload.year))) return res.status(400).json({ message: 'Invalid payroll month or year.' });
  if (!['allowance', 'deduction', 'advance'].includes(String(payload.type))) return res.status(400).json({ message: 'Invalid adjustment type.' });
  if (!Number.isFinite(Number(payload.amount)) || Number(payload.amount) <= 0) return res.status(400).json({ message: 'Adjustment amount must be greater than zero.' });
  const { ids } = await scopedEmployeeIds(req.user);
  if (!ids.has(String(payload.employeeId))) return res.status(403).json({ message: 'Employee is outside your access scope.' });
  const adjustment = await upsertPayrollAdjustmentRepo(payload, req.user?.name || 'System Owner');
  const adjustments = (await listPayrollAdjustmentsRepo({ month: payload.month, year: payload.year }))
    .filter((item) => ids.has(String(item.employeeId)));
  res.json({ adjustment, adjustments });
});

router.delete('/adjustments/:id', async (req, res) => {
  if (!canManagePayroll(req.user)) return res.status(403).json({ message: 'You do not have permission to delete payroll adjustments.' });
  const { ids } = await scopedEmployeeIds(req.user);
  const adjustment = (await listPayrollAdjustmentsRepo()).find((item) => String(item.id) === String(req.params.id));
  if (!adjustment) return res.status(404).json({ message: 'Payroll adjustment not found.' });
  if (!ids.has(String(adjustment.employeeId))) return res.status(403).json({ message: 'Adjustment is outside your access scope.' });
  const removed = await deletePayrollAdjustmentRepo(req.params.id, req.user?.name || 'System Owner');
  if (!removed) return res.status(404).json({ message: 'Payroll adjustment not found.' });
  res.json({ removed });
});

router.get('/runs/:id/payslip/:employeeId', async (req, res) => {
  if (!canViewPayroll(req.user)) return res.status(403).json({ message: 'Payroll is not available for this account.' });
  const slip = await getPayrollSlipRepo(req.params.id, req.params.employeeId);
  if (!slip) return res.status(404).json({ message: 'Payroll slip not found.' });
  if (!runIsInScope(slip.run, req.user)) return res.status(403).json({ message: 'Payroll run is outside your access scope.' });
  const { ids } = await scopedEmployeeIds(req.user);
  if (!ids.has(String(slip.item.employeeId))) return res.status(403).json({ message: 'Payslip is outside your access scope.' });
  res.json(slip);
});

export default router;
