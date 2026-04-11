import ExcelJS from 'exceljs';
import { authenticateToken, enforceMaintenance, requirePermission } from '../middleware_auth.js';
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  importAttendanceFromExcel,
  buildMonthlyAttendance,
  exportMonthlyAttendanceExcel,
  requestAttendanceAdjustment,
  reviewAttendanceAdjustment,
  listAttendanceAdjustments,
  getStatusTypes,
  updateAttendanceRecordDirect,
  listAttendanceIssues
} from '../services/attendanceService.js';
import { db } from '../data/store.js';
import { isAttendanceMonthClosedRepo, closeAttendanceMonthRepo, reopenAttendanceMonthRepo, listClosedAttendanceMonthsRepo } from '../data/leaveNotificationRepository.js';
import { getAttendanceAdjustmentByIdRepo } from '../data/attendanceRepository.js';

const router = express.Router();
router.use(authenticateToken, enforceMaintenance);
const uploadDir = path.resolve('src/uploads');
fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ dest: uploadDir });

function getScopedEmployees(user) {
  if (!user) return [];
  if (user.roleId === 1 || user.permissions?.includes('*')) return db.employees;

  let employees = [...db.employees];
  if (user.division === 'Saudi Division') employees = employees.filter((e) => e.nationality === 'SAUDI');
  if (user.division === 'Non-Saudi Division') employees = employees.filter((e) => e.nationality !== 'SAUDI');
  if (user.accessScope === 'Package Only') employees = employees.filter((e) => e.projectId === user.projectId && e.packageId === user.packageId);
  else if (user.accessScope === 'Project Only') employees = employees.filter((e) => e.projectId === user.projectId);
  return employees;
}


async function ensureAttendanceMonthOpen(dateValue) {
  const date = new Date(dateValue);
  const month = date.getUTCMonth() + 1;
  const year = date.getUTCFullYear();
  if (await isAttendanceMonthClosedRepo(month, year)) {
    const error = new Error('This attendance month is locked.');
    error.statusCode = 409;
    throw error;
  }
}

router.get('/month-locks', requirePermission('view_attendance'), async (_req, res) => {
  return res.json({ months: await listClosedAttendanceMonthsRepo() });
});

router.post('/month-locks', requirePermission('lock_month'), express.json(), async (req, res) => {
  const month = Number(req.body.month);
  const year = Number(req.body.year);
  if (!month || !year) return res.status(400).json({ message: 'month and year are required.' });
  const result = await closeAttendanceMonthRepo(month, year, req.user?.id, req.user?.name || 'System Owner', req.body.note || '');
  return res.json({ month: result, message: 'Attendance month locked successfully.' });
});

router.post('/month-locks/open', requirePermission('unlock_month'), express.json(), async (req, res) => {
  const month = Number(req.body.month);
  const year = Number(req.body.year);
  if (!month || !year) return res.status(400).json({ message: 'month and year are required.' });
  const result = await reopenAttendanceMonthRepo(month, year, req.user?.id, req.user?.name || 'System Owner');
  return res.json({ month: result, message: 'Attendance month reopened successfully.' });
});

function buildIssuesWorkbook(rows, month, year) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(`Issues-${year}-${month}`);
  sheet.columns = [
    { header: 'Employee Name', key: 'name', width: 26 },
    { header: 'GAS ID', key: 'gasId', width: 14 },
    { header: 'Project', key: 'project', width: 18 },
    { header: 'Package', key: 'package', width: 18 },
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Issue Type', key: 'issueType', width: 18 },
    { header: 'Status', key: 'status', width: 16 },
    { header: 'Hours', key: 'hours', width: 10 },
    { header: 'Source', key: 'source', width: 12 },
  ];
  sheet.getRow(1).font = { bold: true };
  rows.forEach((row) => sheet.addRow(row));
  for (let r = 2; r <= sheet.rowCount; r += 1) {
    const cell = sheet.getRow(r).getCell(6);
    const issueType = cell.value;
    if (issueType === 'Absent') cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } };
    if (issueType === 'Single Punch') cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4D6' } };
    if (issueType === 'Low Hours') cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9EAF7' } };
  }
  return workbook.xlsx.writeBuffer();
}


router.get('/status-types', (_req, res) => {
  res.json({ statusTypes: getStatusTypes() });
});

router.post('/upload', requirePermission('upload_attendance'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Attendance file is required.' });
    if (Number(req.body.month) && Number(req.body.year) && await isAttendanceMonthClosedRepo(Number(req.body.month), Number(req.body.year))) {
      return res.status(409).json({ message: 'This attendance month is locked.' });
    }
    const result = await importAttendanceFromExcel(req.file.path, {
      fileName: req.file.originalname,
      uploadedBy: req.user?.name || 'System Owner'
    });
    return res.json({ message: 'Attendance imported successfully.', ...result });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

router.get('/monthly', async (req, res) => {
  const month = Number(req.query.month);
  const year = Number(req.query.year);
  if (!month || !year) return res.status(400).json({ message: 'month and year are required.' });
  const rows = await buildMonthlyAttendance({
    month,
    year,
    projectId: req.query.projectId,
    packageId: req.query.packageId
  });
  return res.json({ rows });
});

router.get('/export', requirePermission('export_excel'), async (req, res) => {
  try {
    const month = Number(req.query.month);
    const year = Number(req.query.year);
    if (!month || !year) return res.status(400).json({ message: 'month and year are required.' });
    const rows = await buildMonthlyAttendance({
      month,
      year,
      projectId: req.query.projectId,
      packageId: req.query.packageId
    });
    const buffer = await exportMonthlyAttendanceExcel({ month, year, rows });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="attendance-${year}-${month}.xlsx"`);
    return res.send(Buffer.from(buffer));
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

router.get('/adjustments', async (_req, res) => {
  return res.json({ requests: await listAttendanceAdjustments() });
});

router.post('/direct-update', requirePermission('edit_attendance'), express.json(), async (req, res) => {
  try {
    await ensureAttendanceMonthOpen(req.body.date);
    const result = await updateAttendanceRecordDirect(req.body);
    return res.json({ record: result });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

router.post('/adjustments/request', requirePermission('request_attendance_edit'), express.json(), async (req, res) => {
  try {
    await ensureAttendanceMonthOpen(req.body.date);
    const adjustment = await requestAttendanceAdjustment(req.body);
    return res.status(201).json(adjustment);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

router.post('/adjustments/:id/review', requirePermission('approve_attendance'), express.json(), async (req, res) => {
  try {
    const request = await getAttendanceAdjustmentByIdRepo(req.params.id);
    if (request) await ensureAttendanceMonthOpen(request.date);
    const result = await reviewAttendanceAdjustment(
      req.params.id,
      req.body.decision,
      req.body.reviewerId || 'Project Manager',
      req.body.reviewerName || 'Project Manager',
      req.body.rejectionReason || ''
    );
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

export default router;
