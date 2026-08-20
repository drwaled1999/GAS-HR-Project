import { Router } from "express";
import ExcelJS from "exceljs";
import { authenticateToken, enforceMaintenance } from "../middleware_auth.js";
import { query } from "../data/index.js";
import {
  getUserByUsernameRepo,
  getScopedEmployeesForUserRepo,
} from "../data/userEmployeeRepository.js";
import { listAttendanceAdjustmentsRepo } from "../data/attendanceRepository.js";
import { daysInMonth } from "../utils/date.js";

const router = Router();
router.use(authenticateToken, enforceMaintenance);

async function getActor(req) {
  const username = String(req.user?.username || "").trim();
  return username ? getUserByUsernameRepo(username) : null;
}

function getReportFilters(queryParams) {
  const now = new Date();
  const month = Number(queryParams.month || now.getMonth() + 1);
  const year = Number(queryParams.year || now.getFullYear());
  const date = String(queryParams.date || now.toISOString().slice(0, 10));

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    const error = new Error("الشهر غير صالح");
    error.status = 400;
    throw error;
  }
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    const error = new Error("السنة غير صالحة");
    error.status = 400;
    throw error;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    const error = new Error("التاريخ غير صالح");
    error.status = 400;
    throw error;
  }

  return { month, year, date };
}

async function getProjectsMap() {
  try {
    const { rows } = await query(
      `SELECT id, name
       FROM projects
       ORDER BY name ASC`
    );
    return new Map(rows.map((row) => [String(row.id), row.name]));
  } catch {
    return new Map();
  }
}

async function getPackagesMap() {
  try {
    const { rows } = await query(
      `SELECT id, name
       FROM packages
       ORDER BY name ASC`
    );
    return new Map(rows.map((row) => [String(row.id), row.name]));
  } catch {
    return new Map();
  }
}

function getScopedAttendance(employees, records) {
  const employeeKeys = new Set(
    employees.flatMap((employee) => [employee.id, employee.gasId]
      .filter(Boolean)
      .map((value) => String(value).trim().toLowerCase()))
  );
  return records.filter((record) =>
    employeeKeys.has(String(record.employeeId || "").trim().toLowerCase())
  );
}

function classifyAttendanceRow(row) {
  const override = String(row.override_type || "").trim().toLowerCase();
  const leave = String(row.leave_text || "").trim().toLowerCase();
  const exception = String(row.exception_text || "").trim().toLowerCase();
  const hours = Math.max(0, Number(row.regular_hours || 0));

  if (["weekend", "off", "holiday"].includes(override)) return { status: "Weekend", hours: 0 };
  if (override === "absent" || exception.includes("absence")) return { status: "Absent", hours: 0 };
  if (exception.includes("missing punch")) return { status: "Single Punch", hours: 0 };
  if (override === "annual_leave" || leave.includes("annual")) return { status: "Annual Leave", hours: 0 };
  if (override === "sick_leave" || leave.includes("sick")) return { status: "Sick Leave", hours: 0 };
  if (override === "emergency_leave" || leave.includes("emergency")) return { status: "Emergency Leave", hours: 0 };
  if (override === "permission" || leave.includes("permission")) return { status: "Permission", hours: 0 };
  if (override === "takleef" || leave.includes("takleef") || leave.includes("task")) return { status: "Takleef", hours: 0 };
  if (override === "present" || hours > 0) return { status: "Present", hours: hours || 8 };
  return { status: "No Record", hours: 0 };
}

async function listApprovedAttendanceForReports(month, year) {
  const { rows } = await query(
    `WITH latest_general AS (
       SELECT id FROM attendance_import_batches
       WHERE month_int = $1 AND year_int = $2 AND LOWER(status) = 'approved'
       ORDER BY approved_at DESC NULLS LAST, created_at DESC LIMIT 1
     ), latest_projects AS (
       SELECT DISTINCT ON (project_key) id
       FROM project_attendance_batches
       WHERE month_int = $1 AND year_int = $2 AND LOWER(status) = 'approved'
       ORDER BY project_key, approved_at DESC NULLS LAST, created_at DESC
     )
     SELECT * FROM (
       SELECT ar.employee_code, ar.employee_name, ar.work_date,
              ar.regular_hours, ar.exception_text, ar.leave_text,
              ar.override_type, ar.override_note, ar.updated_at,
              COALESCE(emp.project_name, '') AS project_name,
              COALESCE(emp.package_name, '') AS package_name,
              'general'::text AS source
       FROM attendance_records ar
       JOIN attendance_import_batches ab ON ab.id = ar.import_batch_id
       LEFT JOIN employees emp ON emp.gas_id = ar.employee_code
       WHERE ab.id IN (SELECT id FROM latest_general)
       UNION ALL
       SELECT ar.employee_code, ar.employee_name, ar.work_date,
              ar.regular_hours, ar.exception_text, ar.leave_text,
              ar.override_type, ar.override_note, ar.updated_at,
              COALESCE(emp.project_name, ab.project_name, '') AS project_name,
              COALESCE(emp.package_name, '') AS package_name,
              'project'::text AS source
       FROM project_attendance_records ar
       JOIN project_attendance_batches ab ON ab.id = ar.import_batch_id
       LEFT JOIN employees emp ON emp.gas_id = ar.employee_code
       WHERE ab.id IN (SELECT id FROM latest_projects)
     ) combined
     ORDER BY work_date ASC, employee_code ASC, updated_at ASC NULLS LAST`,
    [month, year]
  );

  const unique = new Map();
  rows.forEach((row) => {
    const employeeId = String(row.employee_code || "").trim();
    const date = row.work_date instanceof Date
      ? row.work_date.toISOString().slice(0, 10)
      : String(row.work_date || "").slice(0, 10);
    if (!employeeId || !date) return;
    const classified = classifyAttendanceRow(row);
    unique.set(`${employeeId.toLowerCase()}__${date}`, {
      employeeId,
      employeeName: row.employee_name || "",
      date,
      hours: classified.hours,
      status: classified.status,
      source: row.source,
      isModified: Boolean(row.override_type),
      note: row.override_note || "",
      projectName: row.project_name || "",
      packageName: row.package_name || "",
    });
  });
  return Array.from(unique.values());
}

function includeUnregisteredAttendanceUsers(user, employees, records) {
  const role = String(user?.roleName || user?.roleCode || "").trim().toLowerCase();
  const broadRoles = new Set([
    "system owner", "system_owner", "owner", "hr manager", "hr_manager",
    "hr admin", "hr_admin", "hr", "admin", "admin assistant", "admin_assistant",
  ]);
  if (!broadRoles.has(role)) return employees;

  const existing = new Set(employees.flatMap((employee) => [employee.id, employee.gasId]
    .filter(Boolean).map((value) => String(value).trim().toLowerCase())));
  const additions = new Map();
  records.forEach((record) => {
    const code = String(record.employeeId || "").trim();
    if (!code || existing.has(code.toLowerCase()) || additions.has(code.toLowerCase())) return;
    additions.set(code.toLowerCase(), {
      id: `attendance-${code}`,
      gasId: code,
      name: record.employeeName || code,
      nationality: "-",
      projectName: record.projectName || "-",
      packageName: record.packageName || "-",
      projectId: null,
      packageId: null,
      joinDate: null,
    });
  });
  return [...employees, ...additions.values()];
}

function isCountableWorkday(date, employee, todayKey) {
  const parsed = new Date(`${date}T12:00:00`);
  const day = parsed.getDay();
  if (day === 5 || day === 6 || date > todayKey) return false;
  if (employee.joinDate && date < String(employee.joinDate).slice(0, 10)) return false;
  return true;
}

function buildMonthlyRows(employees, records, month, year, projectsMap, packagesMap) {
  const totalDays = daysInMonth(year, month);
  const todayKey = new Date().toISOString().slice(0, 10);

  return employees.map((employee) => {
    let totalHours = 0;
    let absentCount = 0;
    let singlePunchCount = 0;
    let leaveCount = 0;

    for (let day = 1; day <= totalDays; day += 1) {
      const date = new Date(Date.UTC(year, month - 1, day))
        .toISOString()
        .slice(0, 10);

      if (!isCountableWorkday(date, employee, todayKey)) continue;

      const record = records.find(
        (r) => [employee.id, employee.gasId].filter(Boolean).some(
          (key) => String(r.employeeId).toLowerCase() === String(key).toLowerCase()
        ) && r.date === date
      );

      if (!record) {
        absentCount += 1;
        continue;
      }

      if (record.status === "Present") {
        totalHours += Number(record.hours || 0);
      } else if (record.status === "Absent") {
        absentCount += 1;
      } else if (record.status === "Single Punch") {
        singlePunchCount += 1;
      } else if (!["Weekend", "No Record"].includes(record.status)) {
        leaveCount += 1;
      } else if (record.status === "No Record") {
        absentCount += 1;
      }
    }

    return {
      employeeId: employee.id,
      name: employee.name,
      gasId: employee.gasId,
      nationality: employee.nationality,
      project: employee.projectName || projectsMap.get(String(employee.projectId)) || "-",
      package: employee.packageName || packagesMap.get(String(employee.packageId)) || "-",
      totalHours: Number(totalHours.toFixed(2)),
      absentCount,
      singlePunchCount,
      leaveCount,
    };
  });
}

function buildDailyRows(employees, records, date, projectsMap, packagesMap) {
  const requestedDate = new Date(`${date}T12:00:00`);
  const defaultStatus = requestedDate.getDay() === 5 || requestedDate.getDay() === 6
    ? "Weekend"
    : date > new Date().toISOString().slice(0, 10) ? "No Record" : "Absent";
  return employees.map((employee) => {
    const record = records.find(
      (r) => [employee.id, employee.gasId].filter(Boolean).some(
        (key) => String(r.employeeId).toLowerCase() === String(key).toLowerCase()
      ) && r.date === date
    );

    return {
      employeeId: employee.id,
      name: employee.name,
      gasId: employee.gasId,
      nationality: employee.nationality,
      project: employee.projectName || projectsMap.get(String(employee.projectId)) || "-",
      package: employee.packageName || packagesMap.get(String(employee.packageId)) || "-",
      status: record?.status || defaultStatus,
      hours: Number(record?.hours || 0),
      source: record?.source || "system",
      isModified: Boolean(record?.isModified),
    };
  });
}

function buildIssuesRows(employees, records, month, year, projectsMap, packagesMap) {
  const totalDays = daysInMonth(year, month);
  const todayKey = new Date().toISOString().slice(0, 10);
  const rows = [];

  for (const employee of employees) {
    for (let day = 1; day <= totalDays; day += 1) {
      const date = new Date(Date.UTC(year, month - 1, day))
        .toISOString()
        .slice(0, 10);

      if (!isCountableWorkday(date, employee, todayKey)) continue;

      const record = records.find(
        (r) => [employee.id, employee.gasId].filter(Boolean).some(
          (key) => String(r.employeeId).toLowerCase() === String(key).toLowerCase()
        ) && r.date === date
      );

      const status = record?.status || "Absent";

      if (status === "Absent" || status === "Single Punch") {
        rows.push({
          employeeId: employee.id,
          name: employee.name,
          gasId: employee.gasId,
          nationality: employee.nationality,
          project: employee.projectName || projectsMap.get(String(employee.projectId)) || "-",
          package: employee.packageName || packagesMap.get(String(employee.packageId)) || "-",
          date,
          status,
          hours: Number(record?.hours || 0),
          source: record?.source || "system",
        });
      }
    }
  }

  return rows;
}

function buildRequestsRows(user, employees, adjustments) {
  const employeeIds = new Set(employees.map((e) => String(e.id)));
  let requests = adjustments.filter((r) => employeeIds.has(String(r.employeeId)));

  if (["Engineer", "Supervisor"].includes(String(user?.jobTitle || ""))) {
    requests = requests.filter(
      (r) => String(r.requestedById || "") === String(user.id)
    );
  }

  const employeeMap = new Map(
    employees.map((employee) => [String(employee.id), employee])
  );

  return requests.map((item) => {
    const employee = employeeMap.get(String(item.employeeId));

    return {
      id: item.id,
      employeeName: item.employeeName || employee?.name || "-",
      gasId: employee?.gasId || "-",
      date: item.date,
      currentValue: item.currentStatus || "-",
      requestedValue: item.newStatus || "-",
      status: item.status,
      requestedByName: item.requestedByName || "-",
      approverName: item.reviewedByName || "-",
      reason: item.reason || "-",
    };
  });
}

async function exportWorkbook(type, rows, meta) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(type);

  const headersByType = {
    monthly: [
      ["Employee Name", "name"],
      ["GAS ID", "gasId"],
      ["Nationality", "nationality"],
      ["Project", "project"],
      ["Package", "package"],
      ["Total Hours", "totalHours"],
      ["Absent Days", "absentCount"],
      ["Single Punch", "singlePunchCount"],
      ["Leave Days", "leaveCount"],
    ],
    daily: [
      ["Employee Name", "name"],
      ["GAS ID", "gasId"],
      ["Nationality", "nationality"],
      ["Project", "project"],
      ["Package", "package"],
      ["Status", "status"],
      ["Hours", "hours"],
      ["Source", "source"],
      ["Modified", "isModified"],
    ],
    issues: [
      ["Employee Name", "name"],
      ["GAS ID", "gasId"],
      ["Nationality", "nationality"],
      ["Project", "project"],
      ["Package", "package"],
      ["Date", "date"],
      ["Status", "status"],
      ["Hours", "hours"],
      ["Source", "source"],
    ],
    requests: [
      ["Employee Name", "employeeName"],
      ["GAS ID", "gasId"],
      ["Date", "date"],
      ["Current", "currentValue"],
      ["Requested", "requestedValue"],
      ["Status", "status"],
      ["Requested By", "requestedByName"],
      ["Approver", "approverName"],
      ["Reason", "reason"],
    ],
  };

  const headers = headersByType[type];
  sheet.columns = headers.map(([header, key]) => ({ header, key, width: 18 }));
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  rows.forEach((row) => sheet.addRow(row));

  for (let i = 2; i <= sheet.rowCount; i += 1) {
    for (let c = 1; c <= sheet.columnCount; c += 1) {
      const cell = sheet.getRow(i).getCell(c);

      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };

      const value = cell.value;

      if (value === "Absent") {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFFC7CE" },
        };
      }

      if (value === "Single Punch") {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFCE4D6" },
        };
      }

      if (typeof value === "string" && value.toLowerCase().includes("leave")) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFD9EAF7" },
        };
      }
    }
  }

  const metaSheet = workbook.addWorksheet("Report Info");
  metaSheet.columns = [
    { header: "Field", key: "field", width: 20 },
    { header: "Value", key: "value", width: 30 },
  ];
  metaSheet.getRow(1).font = { bold: true };

  Object.entries(meta).forEach(([field, value]) => {
    metaSheet.addRow({ field, value: String(value ?? "-") });
  });

  return workbook.xlsx.writeBuffer();
}

router.get("/summary", async (req, res) => {
  try {
    const user = await getActor(req);
    const { month, year, date } = getReportFilters(req.query);

    if (!user) {
      return res.status(404).json({ message: "المستخدم غير موجود" });
    }

    const [employees, allRecords, adjustments, projectsMap, packagesMap] =
      await Promise.all([
        getScopedEmployeesForUserRepo(user),
        listApprovedAttendanceForReports(month, year),
        listAttendanceAdjustmentsRepo(),
        getProjectsMap(),
        getPackagesMap(),
      ]);

    const reportEmployees = allRecords.length
      ? includeUnregisteredAttendanceUsers(user, employees, allRecords)
      : [];
    const records = getScopedAttendance(reportEmployees, allRecords);

    const monthlyRows = buildMonthlyRows(
      reportEmployees,
      records,
      month,
      year,
      projectsMap,
      packagesMap
    );

    const dailyRows = buildDailyRows(
      reportEmployees,
      records,
      date,
      projectsMap,
      packagesMap
    );

    const issuesRows = buildIssuesRows(
      reportEmployees,
      records,
      month,
      year,
      projectsMap,
      packagesMap
    );

    const requestsRows = buildRequestsRows(user, reportEmployees, adjustments);

    const summary = {
      visibleEmployees: reportEmployees.length,
      monthlyHours: Number(
        monthlyRows.reduce((sum, row) => sum + row.totalHours, 0).toFixed(2)
      ),
      absentDays: monthlyRows.reduce((sum, row) => sum + row.absentCount, 0),
      singlePunchCount: monthlyRows.reduce(
        (sum, row) => sum + row.singlePunchCount,
        0
      ),
      leaveDays: monthlyRows.reduce((sum, row) => sum + row.leaveCount, 0),
      pendingRequests: requestsRows.filter((row) => row.status === "pending")
        .length,
    };

    return res.json({
      summary,
      monthlyRows,
      dailyRows,
      issuesRows,
      requestsRows,
    });
  } catch (error) {
    console.error("Reports summary error:", error);
    return res.status(error.status || 500).json({
      message: "فشل تحميل ملخص التقارير",
      error: error.message,
    });
  }
});

router.get("/export", async (req, res) => {
  try {
    const type = req.query.type || "monthly";
    const user = await getActor(req);
    const { month, year, date } = getReportFilters(req.query);

    if (!user) {
      return res.status(404).json({ message: "المستخدم غير موجود" });
    }

    const [employees, allRecords, adjustments, projectsMap, packagesMap] =
      await Promise.all([
        getScopedEmployeesForUserRepo(user),
        listApprovedAttendanceForReports(month, year),
        listAttendanceAdjustmentsRepo(),
        getProjectsMap(),
        getPackagesMap(),
      ]);

    const reportEmployees = allRecords.length
      ? includeUnregisteredAttendanceUsers(user, employees, allRecords)
      : [];
    const records = getScopedAttendance(reportEmployees, allRecords);

    const rowsByType = {
      monthly: buildMonthlyRows(
        reportEmployees,
        records,
        month,
        year,
        projectsMap,
        packagesMap
      ),
      daily: buildDailyRows(
        reportEmployees,
        records,
        date,
        projectsMap,
        packagesMap
      ),
      issues: buildIssuesRows(
        reportEmployees,
        records,
        month,
        year,
        projectsMap,
        packagesMap
      ),
      requests: buildRequestsRows(user, reportEmployees, adjustments),
    };

    if (!rowsByType[type]) {
      return res.status(400).json({ message: "نوع التقرير غير مدعوم" });
    }

    const buffer = await exportWorkbook(type, rowsByType[type], {
      username: user.username,
      role: user.jobTitle || user.roleName || user.role || "-",
      division: user.division || "-",
      month,
      year,
      date,
      generatedAt: new Date().toISOString(),
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="report-${type}-${year}-${month}.xlsx"`
    );

    return res.send(Buffer.from(buffer));
  } catch (error) {
    console.error("Reports export error:", error);
    return res.status(error.status || 500).json({
      message: "فشل تصدير التقرير",
      error: error.message,
    });
  }
});

export default router;
