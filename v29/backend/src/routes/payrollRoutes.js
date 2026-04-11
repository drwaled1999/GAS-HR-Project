import { Router } from 'express';
import ExcelJS from 'exceljs';
import { authenticateToken, enforceMaintenance, requireSystemOwner } from '../middleware_auth.js';
import { buildPayrollSummary } from '../services/payrollService.js';
import { createPayrollRunRepo, deletePayrollAdjustmentRepo, deleteWorkHourPolicyRepo, getPayrollRunDetailsRepo, getPayrollSlipRepo, listEmployeeCompensationRepo, listPayrollAdjustmentsRepo, listPayrollRunsRepo, listSalaryTransferRequestsRepo, listWorkHourPoliciesRepo, upsertEmployeeCompensationRepo, upsertPayrollAdjustmentRepo, upsertWorkHourPolicyRepo } from '../data/payrollRepository.js';

const router = Router();
router.use(authenticateToken, enforceMaintenance);

function canViewPayroll(user) {
  return user && user.roleId !== 6;
}

function canManagePayroll(user) {
  return user && (user.roleId === 1 || user.roleId === 2 || user.roleId === 3);
}

router.get('/summary', async (req, res) => {
  if (!canViewPayroll(req.user)) return res.status(403).json({ message: 'Payroll is not available for this account.' });
  const month = Number(req.query.month || 4);
  const year = Number(req.query.year || 2026);
  const summary = await buildPayrollSummary({ user: req.user, month, year });
  res.json({ summary, workHourPolicies: await listWorkHourPoliciesRepo() });
});

router.post('/run', async (req, res) => {
  if (!canManagePayroll(req.user)) return res.status(403).json({ message: 'You do not have permission to create payroll runs.' });
  const month = Number(req.body?.month || req.query.month || 4);
  const year = Number(req.body?.year || req.query.year || 2026);
  const summary = await buildPayrollSummary({ user: req.user, month, year });
  const run = await createPayrollRunRepo({ user: req.user, month, year, summary });
  res.json({ run, summary });
});

router.get('/runs', async (req, res) => {
  if (!canViewPayroll(req.user)) return res.status(403).json({ message: 'Payroll is not available for this account.' });
  res.json({ runs: await listPayrollRunsRepo() });
});

router.get('/runs/:id', async (req, res) => {
  if (!canViewPayroll(req.user)) return res.status(403).json({ message: 'Payroll is not available for this account.' });
  const details = await getPayrollRunDetailsRepo(req.params.id);
  if (!details) return res.status(404).json({ message: 'Payroll run not found.' });
  res.json(details);
});

router.get('/salary-transfer-requests', async (req, res) => {
  if (!canManagePayroll(req.user)) return res.status(403).json({ message: 'You do not have permission to review salary transfer requests.' });
  res.json({ requests: await listSalaryTransferRequestsRepo(req.user) });
});

router.get('/export', async (req, res) => {
  if (!canViewPayroll(req.user)) return res.status(403).json({ message: 'Payroll is not available for this account.' });
  const month = Number(req.query.month || 4);
  const year = Number(req.query.year || 2026);
  const { rows } = await buildPayrollSummary({ user: req.user, month, year });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(`Payroll-${year}-${month}`);
  sheet.columns = [
    { header: 'Employee Name', key: 'employeeName', width: 28 },
    { header: 'GAS ID', key: 'gasId', width: 14 },
    { header: 'Nationality', key: 'nationality', width: 14 },
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
  res.json({ compensation: await listEmployeeCompensationRepo() });
});

router.post('/compensation', async (req, res) => {
  if (!canManagePayroll(req.user)) return res.status(403).json({ message: 'You do not have permission to manage payroll compensation.' });
  const payload = req.body || {};
  if (!payload.employeeId) return res.status(400).json({ message: 'Employee is required.' });
  const compensation = await upsertEmployeeCompensationRepo(payload, req.user?.name || 'System Owner');
  res.json({ compensation, compensationItems: await listEmployeeCompensationRepo() });
});

router.get('/adjustments', async (req, res) => {
  if (!canViewPayroll(req.user)) return res.status(403).json({ message: 'Payroll is not available for this account.' });
  const month = Number(req.query.month || 4);
  const year = Number(req.query.year || 2026);
  res.json({ adjustments: await listPayrollAdjustmentsRepo({ month, year }) });
});

router.post('/adjustments', async (req, res) => {
  if (!canManagePayroll(req.user)) return res.status(403).json({ message: 'You do not have permission to manage payroll adjustments.' });
  const payload = req.body || {};
  if (!payload.employeeId || !payload.type || !payload.label) return res.status(400).json({ message: 'Employee, type, and label are required.' });
  const adjustment = await upsertPayrollAdjustmentRepo(payload, req.user?.name || 'System Owner');
  res.json({ adjustment, adjustments: await listPayrollAdjustmentsRepo({ month: payload.month, year: payload.year }) });
});

router.delete('/adjustments/:id', async (req, res) => {
  if (!canManagePayroll(req.user)) return res.status(403).json({ message: 'You do not have permission to delete payroll adjustments.' });
  const removed = await deletePayrollAdjustmentRepo(req.params.id, req.user?.name || 'System Owner');
  if (!removed) return res.status(404).json({ message: 'Payroll adjustment not found.' });
  res.json({ removed });
});

router.get('/runs/:id/payslip/:employeeId', async (req, res) => {
  if (!canViewPayroll(req.user)) return res.status(403).json({ message: 'Payroll is not available for this account.' });
  const slip = await getPayrollSlipRepo(req.params.id, req.params.employeeId);
  if (!slip) return res.status(404).json({ message: 'Payroll slip not found.' });
  res.json(slip);
});

export default router;
