import XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import {
  db,
  getEmployeeByGasId,
  getProjectById,
  getPackageById,
  addAuditLog,
  getUserById
} from '../data/index.js';
import { createNotificationRepo } from '../data/leaveNotificationRepository.js';
import {
  createAttendanceAdjustmentRepo,
  createAttendanceUploadRepo,
  getAttendanceAdjustmentByIdRepo,
  listAttendanceAdjustmentsRepo,
  listAttendanceRecordsRepo,
  reviewAttendanceAdjustmentRepo,
  upsertAttendanceRecordRepo
} from '../data/attendanceRepository.js';
import { normalizeExcelDate, daysInMonth } from '../utils/date.js';
import { normalizeHours, roundHours } from '../utils/number.js';

const REQUIRED_HINTS = {
  gasId: ['gas id', 'gas-id', 'gas_id', 'employee id'],
  employeeName: ['employee name', 'name', 'employee'],
  date: ['date', 'attendance date', 'work date'],
  regularHours: ['regular hours', 'regular hour', 'hours', 'work hours']
};

const STATUS_TYPES = [
  { code: 'Present', name: 'Present', color: '#e9f8ef', requiresAttachment: false },
  { code: 'Absent', name: 'Absent', color: '#ffeaea', requiresAttachment: false },
  { code: 'Single Punch', name: 'Single Punch', color: '#fff1e5', requiresAttachment: false },
  { code: 'Annual Leave', name: 'Annual Leave', color: '#e8f0ff', requiresAttachment: true },
  { code: 'Emergency Leave', name: 'Emergency Leave', color: '#fff7d6', requiresAttachment: true },
  { code: 'Sick Leave', name: 'Sick Leave', color: '#f1e8ff', requiresAttachment: true },
  { code: 'Hajj', name: 'Hajj', color: '#efe8ff', requiresAttachment: true },
  { code: 'Umrah', name: 'Umrah', color: '#e9f4ff', requiresAttachment: true },
  { code: 'Official Holiday', name: 'Official Holiday', color: '#eef1f6', requiresAttachment: false },
  { code: 'Weekend', name: 'Weekend', color: '#f5f5f5', requiresAttachment: false },
  { code: 'Business Trip', name: 'Business Trip', color: '#e2f5ff', requiresAttachment: false },
  { code: 'Training', name: 'Training', color: '#ebfff1', requiresAttachment: false },
  { code: 'Excused Absence', name: 'Excused Absence', color: '#fff8e8', requiresAttachment: false },
  { code: 'Unpaid Leave', name: 'Unpaid Leave', color: '#f4e9e9', requiresAttachment: true }
];

function normalizeHeaderName(header) {
  return String(header || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function detectColumns(headers) {
  const normalized = headers.map((h) => normalizeHeaderName(h));
  const result = {};

  for (const [key, hints] of Object.entries(REQUIRED_HINTS)) {
    const index = normalized.findIndex((header) => hints.includes(header));
    if (index >= 0) result[key] = headers[index];
  }

  return result;
}

function dateFromDay(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
}

function getDefaultApproverUserId(employeeId) {
  const employee = db.employees.find((item) => item.id === Number(employeeId));
  if (!employee) return null;
  const project = getProjectById(employee.projectId);
  return project?.projectManagerUserId || project?.cmUserId || null;
}

export function getStatusTypes() {
  return STATUS_TYPES;
}

export async function importAttendanceFromExcel(filePath, uploadMeta = {}) {
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  if (!rows.length) {
    throw new Error('The attendance file is empty.');
  }

  const headers = Object.keys(rows[0]);
  const columns = detectColumns(headers);
  if (!columns.gasId || !columns.date || !columns.regularHours) {
    throw new Error('Missing required columns. Expected GAS ID, Date, and Regular Hours.');
  }

  const upload = await createAttendanceUploadRepo({
    fileName: uploadMeta.fileName,
    uploadedBy: uploadMeta.uploadedBy || 'system',
    columns
  });
  const uploadId = upload.id;

  const grouped = new Map();
  const unmatched = [];

  for (const row of rows) {
    const gasId = String(row[columns.gasId]).trim();
    const date = normalizeExcelDate(row[columns.date]);
    const regularHours = normalizeHours(row[columns.regularHours]);
    const employee = getEmployeeByGasId(gasId);

    if (!gasId || !date) continue;
    if (!employee) {
      unmatched.push({ gasId, name: row[columns.employeeName] || '', date, regularHours });
      continue;
    }

    const key = `${employee.id}__${date}`;
    const current = grouped.get(key) || {
      employeeId: employee.id,
      date,
      hours: 0,
      uploadId
    };

    current.hours += regularHours;
    grouped.set(key, current);
  }

  for (const record of grouped.values()) {
    const rounded = roundHours(record.hours);
    const status = rounded > 0 ? 'Present' : 'Single Punch';
    await upsertAttendanceRecordRepo({
      employeeId: record.employeeId,
      date: record.date,
      hours: rounded,
      status,
      source: 'fingerprint',
      uploadId,
      isModified: false,
      note: ''
    });
  }

  addAuditLog('attendance_imported', uploadMeta.uploadedBy || 'System Owner', {
    fileName: uploadMeta.fileName,
    importedCount: grouped.size,
    unmatchedCount: unmatched.length
  });

  return {
    importedCount: grouped.size,
    unmatchedCount: unmatched.length,
    unmatched,
    uploadId
  };
}

export async function buildMonthlyAttendance({ month, year, projectId, packageId }) {
  const totalDays = daysInMonth(year, month);
  const attendanceRecords = await listAttendanceRecordsRepo();
  let employees = [...db.employees];
  if (projectId) employees = employees.filter((e) => e.projectId === Number(projectId));
  if (packageId) employees = employees.filter((e) => e.packageId === Number(packageId));

  return employees.map((employee) => {
    const row = {
      employeeId: employee.id,
      name: employee.name,
      gasId: employee.gasId,
      nationality: employee.nationality,
      projectId: employee.projectId,
      packageId: employee.packageId
    };

    for (let day = 1; day <= totalDays; day += 1) {
      const date = dateFromDay(year, month, day);
      const record = attendanceRecords.find((r) => r.employeeId === employee.id && r.date === date);

      if (!record) {
        row[String(day)] = { value: 'Absent', status: 'Absent', source: 'system', isModified: false };
      } else if (record.status !== 'Present') {
        row[String(day)] = {
          value: record.status,
          status: record.status,
          source: record.source,
          isModified: Boolean(record.isModified),
          note: record.note || ''
        };
      } else {
        row[String(day)] = {
          value: record.hours,
          status: 'Present',
          hours: record.hours,
          source: record.source,
          isModified: Boolean(record.isModified),
          note: record.note || ''
        };
      }
    }

    return row;
  });
}

export async function exportMonthlyAttendanceExcel({ month, year, rows }) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(`Attendance-${year}-${month}`);
  const totalDays = daysInMonth(year, month);

  const columns = [
    { header: 'Employee Name', key: 'name', width: 28 },
    { header: 'GAS ID', key: 'gasId', width: 14 },
    { header: 'Nationality', key: 'nationality', width: 14 }
  ];

  for (let day = 1; day <= totalDays; day += 1) {
    columns.push({ header: String(day), key: String(day), width: 14 });
  }

  sheet.columns = columns;
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  rows.forEach((row) => {
    const flat = { name: row.name, gasId: row.gasId, nationality: row.nationality };
    for (let day = 1; day <= totalDays; day += 1) {
      flat[String(day)] = row[String(day)]?.value;
    }
    sheet.addRow(flat);
  });

  for (let i = 2; i <= sheet.rowCount; i += 1) {
    const row = sheet.getRow(i);
    for (let c = 4; c <= totalDays + 3; c += 1) {
      const cell = row.getCell(c);
      const value = cell.value;
      if (value === 'Absent') {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } };
      } else if (value === 'Single Punch') {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4D6' } };
      } else if (typeof value === 'string' && value.toLowerCase().includes('leave')) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9EAF7' } };
      }
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    }
  }

  return workbook.xlsx.writeBuffer();
}

export async function updateAttendanceRecordDirect({ employeeId, date, newStatus, hours, actorName, note }) {
  const numericHours = Number(hours || 0);
  const record = await upsertAttendanceRecordRepo({
    employeeId: Number(employeeId),
    date,
    hours: newStatus === 'Present' ? numericHours : 0,
    status: newStatus,
    source: 'manual',
    isModified: true,
    note: note || ''
  });

  addAuditLog('attendance_updated_direct', actorName || 'HR Manager', {
    employeeId: Number(employeeId),
    date,
    newStatus,
    hours: newStatus === 'Present' ? numericHours : 0
  });

  return record;
}

export async function requestAttendanceAdjustment(payload) {
  const approverUserId = payload.approverUserId || getDefaultApproverUserId(payload.employeeId);
  const adjustment = await createAttendanceAdjustmentRepo({
    approverUserId,
    ...payload
  });
  if (approverUserId) {
    await createNotificationRepo(
      approverUserId,
      `New attendance adjustment for ${payload.employeeName || payload.employeeId} on ${payload.date}`,
      'attendance_adjustment',
      '/requests',
      { requestId: adjustment.id, employeeId: payload.employeeId }
    );
  }
  addAuditLog('attendance_adjustment_requested', payload.requestedByName || 'Engineer', {
    employeeId: payload.employeeId,
    date: payload.date,
    requestedStatus: payload.newStatus,
    approverUserId
  });
  return adjustment;
}

export async function listAttendanceAdjustments() {
  return listAttendanceAdjustmentsRepo();
}

export async function reviewAttendanceAdjustment(id, decision, reviewerId, reviewerName, rejectionReason = '') {
  const request = await getAttendanceAdjustmentByIdRepo(id);
  if (!request) throw new Error('Adjustment request not found.');
  const reviewedAt = new Date().toISOString();
  const reviewed = await reviewAttendanceAdjustmentRepo(id, {
    status: decision,
    reviewedBy: reviewerId,
    reviewedByName: reviewerName,
    reviewedAt,
    rejectionReason
  });

  if (decision === 'approved') {
    await upsertAttendanceRecordRepo({
      employeeId: request.employeeId,
      date: request.date,
      hours: request.newStatus === 'Present' ? Number(request.hours || 0) : 0,
      status: request.newStatus,
      source: 'manual',
      isModified: true,
      note: request.reason || '',
      requestId: request.id
    });
  }

  const requester = getUserById(request.requestedById);
  if (requester?.id) {
    await createNotificationRepo(
      requester.id,
      `Your attendance adjustment for ${request.employeeName || request.employeeId} was ${decision}.`,
      'attendance_review',
      '/requests',
      { requestId: request.id, decision }
    );
  }

  addAuditLog('attendance_adjustment_reviewed', reviewerName || 'Project Manager', {
    requestId: request.id,
    decision,
    employeeId: request.employeeId,
    date: request.date
  });

  return reviewed;
}


export async function listAttendanceIssues({ month, year }) {
  const totalDays = daysInMonth(year, month);
  const attendanceRecords = await listAttendanceRecordsRepo();
  const rows = [];
  const summary = { absent: 0, singlePunch: 0, missingRecord: 0, lowHours: 0, modifiedRecord: 0 };

  for (const employee of db.employees) {
    for (let day = 1; day <= totalDays; day += 1) {
      const date = new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
      const record = attendanceRecords.find((item) => item.employeeId === employee.id && item.date === date);
      let issueType = null;
      let note = '';
      if (!record) {
        issueType = 'Missing Record';
        summary.missingRecord += 1;
      } else if (record.status === 'Absent') {
        issueType = 'Absent';
        summary.absent += 1;
      } else if (record.status === 'Single Punch') {
        issueType = 'Single Punch';
        summary.singlePunch += 1;
      } else if (record.status === 'Present' && Number(record.hours || 0) > 0 && Number(record.hours || 0) < 8) {
        issueType = 'Low Hours';
        note = 'Potential late / early-out based on available hours only.';
        summary.lowHours += 1;
      } else if (record.isModified) {
        issueType = 'Modified Record';
        summary.modifiedRecord += 1;
      }

      if (issueType) {
        rows.push({
          employeeId: employee.id,
          gasId: employee.gasId,
          name: employee.name,
          nationality: employee.nationality,
          project: getProjectById(employee.projectId)?.name || '-',
          package: getPackageById(employee.packageId)?.name || '-',
          date,
          status: record?.status || 'Missing',
          hours: Number(record?.hours || 0),
          source: record?.source || 'system',
          issueType,
          note,
          isModified: Boolean(record?.isModified)
        });
      }
    }
  }

  return { rows, summary };
}
