import { Router } from "express";
import ExcelJS from "exceljs";
import { authenticateToken, enforceMaintenance } from "../middleware_auth.js";
import { query } from "../data/index.js";
import {
  getUserByUsernameRepo,
  getScopedEmployeesForUserRepo,
} from "../data/userEmployeeRepository.js";
import {
  listAttendanceRecordsRepo,
  listAttendanceAdjustmentsRepo,
} from "../data/attendanceRepository.js";
import { daysInMonth } from "../utils/date.js";

const router = Router();
router.use(authenticateToken, enforceMaintenance);

async function getActor(req) {
  const username = String(req.query.username || req.user?.username || "").trim();

  if (username) {
    const byQuery = await getUserByUsernameRepo(username);
    if (byQuery) return byQuery;
  }

  if (req.user?.username) {
    return getUserByUsernameRepo(req.user.username);
  }

  return null;
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

function normalizeDate(value) {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);

  return date.toISOString().slice(0, 10);
}

function normalizeStatus(value) {
  const text = String(value || "").trim().toLowerCase();

  if (!text) return "";
  if (text === "present" || text === "p") return "Present";
  if (text === "absent" || text === "a") return "Absent";
  if (text === "single punch" || text === "sp") return "Single Punch";
  if (text.includes("annual")) return "Annual Leave";
  if (text.includes("sick")) return "Sick Leave";
  if (text.includes("emergency")) return "Emergency Leave";
  if (text.includes("leave")) return "Leave";

  return value;
}

function getScopedAttendance(employees, records) {
  const employeeIds = new Set(employees.map((e) => String(e.id)));
  const employeeGasIds = new Set(
    employees.map((e) => String(e.gasId || e.gas_id || "")).filter(Boolean)
  );

  return records.filter((record) => {
    const recordEmployeeId = String(record.employeeId || record.employee_id || "");
    const recordGasId = String(record.employeeCode || record.employee_code || record.gasId || "");

    return employeeIds.has(recordEmployeeId) || employeeGasIds.has(recordGasId);
  });
}

function findEmployeeRecord(employee, records, date) {
  return records.find((record) => {
    const recordDate = normalizeDate(record.date || record.work_date);
    if (recordDate !== date) return false;

    const sameEmployeeId =
      record.employeeId &&
      String(record.employeeId) === String(employee.id);

    const sameEmployeeIdSnake =
      record.employee_id &&
      String(record.employee_id) === String(employee.id);

    const sameGasId =
      (record.employeeCode || record.employee_code || record.gasId) &&
      String(record.employeeCode || record.employee_code || record.gasId) ===
        String(employee.gasId || employee.gas_id || "");

    return sameEmployeeId || sameEmployeeIdSnake || sameGasId;
  });
}

function getRecordStatus(record) {
  if (!record) return "";

  const overrideType = String(record.overrideType || record.override_type || "").trim();

  if (overrideType) {
    const map = {
      present: "Present",
      absent: "Absent",
      weekend: "Weekend",
      annual_leave: "Annual Leave",
      sick_leave: "Sick Leave",
      emergency_leave: "Emergency Leave",
      permission: "Permission",
      takleef: "Takleef",
    };

    return map[overrideType] || normalizeStatus(overrideType);
  }

  return normalizeStatus(record.status || record.exceptionText || record.exception_text || "Present");
}

function getRecordHours(record) {
  if (!record) return 0;

  return Number(
    record.hours ??
      record.regularHours ??
      record.regular_hours ??
      record.totalHours ??
      record.total_work_hours ??
      0
  );
}

function hasAnyRecordForDate(records, date) {
  return records.some((record) => normalizeDate(record.date || record.work_date) === date);
}

function isWeekendDate(date) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();

  // Friday = 5, Saturday = 6
  return day === 5 || day === 6;
}

function buildMonthlyRows(employees, records, month, year, projectsMap, packagesMap) {
  const totalDays = daysInMonth(year, month);

  return employees.map((employee) => {
    let totalHours = 0;
    let absentCount = 0;
    let singlePunchCount = 0;
    let leaveCount = 0;

    for (let day = 1; day <= totalDays; day += 1) {
      const date = new Date(Date.UTC(year, month - 1, day))
        .toISOString()
        .slice(0, 10);

      // لا تحسب غياب في يوم ما تم استيراده أصلاً
      if (!hasAnyRecordForDate(records, date)) {
        continue;
      }

      if (isWeekendDate(date)) {
        continue;
      }

      const record = findEmployeeRecord(employee, records, date);

      if (!record) {
        absentCount += 1;
        continue;
      }

      const status = getRecordStatus(record);

      if (status === "Present") {
        totalHours += getRecordHours(record);
      } else if (status === "Absent") {
        absentCount += 1;
      } else if (status === "Single Punch") {
        singlePunchCount += 1;
      } else if (status !== "Weekend") {
        leaveCount += 1;
      }
    }

    return {
      employeeId: employee.id,
      name: employee.name,
      gasId: employee.gasId,
      nationality: employee.nationality,
      project: projectsMap.get(String(employee.projectId)) || "-",
      package: packagesMap.get(String(employee.packageId)) || "-",
      totalHours: Number(totalHours.toFixed(2)),
      absentCount,
      singlePunchCount,
      leaveCount,
    };
  });
}

function buildDailyRows(employees, records, date, projectsMap, packagesMap) {
  const hasImportedDate = hasAnyRecordForDate(records, date);

  return employees.map((employee) => {
    const record = findEmployeeRecord(employee, records, date);
    const status = record ? getRecordStatus(record) : hasImportedDate ? "Absent" : "Not Imported";

    return {
      employeeId: employee.id,
      name: employee.name,
      gasId: employee.gasId,
      nationality: employee.nationality,
      project: projectsMap.get(String(employee.projectId)) || "-",
      package: packagesMap.get(String(employee.packageId)) || "-",
      status,
      hours: Number(getRecordHours(record).toFixed(2)),
      source: record?.source || (record ? "attendance" : "system"),
      isModified: Boolean(record?.isModified || record?.is_modified || record?.overrideType || record?.override_type),
    };
  });
}

function buildIssuesRows(employees, records, month, year, projectsMap, packagesMap) {
  const totalDays = daysInMonth(year, month);
  const rows = [];

  for (const employee of employees) {
    for (let day = 1; day <= totalDays; day += 1) {
      const date = new Date(Date.UTC(year, month - 1, day))
        .toISOString()
        .slice(0, 10);

      if (!hasAnyRecordForDate(records, date)) {
        continue;
      }

      if (isWeekendDate(date)) {
        continue;
      }

      const record = findEmployeeRecord(employee, records, date);
      const status = record ? getRecordStatus(record) : "Absent";

      if (status === "Absent" || status === "Single Punch") {
        rows.push({
          employeeId: employee.id,
          name: employee.name,
          gasId: employee.gasId,
          nationality: employee.nationality,
          project: projectsMap.get(String(employee.projectId)) || "-",
          package: packagesMap.get(String(employee.packageId)) || "-",
          date,
          status,
          hours: Number(getRecordHours(record).toFixed(2)),
          source: record?.source || (record ? "attendance" : "system"),
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

  sheet.columns = headers.map(([header, key]) => ({
    header,
    key,
    width: Math.max(18, String(header).length + 4),
  }));

  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E3A8A" },
  };

  sheet.views = [{ state: "frozen", ySplit: 1 }];

  rows.forEach((row) => sheet.addRow(row));

  for (let i = 2; i <= sheet.rowCount; i += 1) {
    for (let c = 1; c <= sheet.columnCount; c += 1) {
      const cell = sheet.getRow(i).getCell(c);

      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
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

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: sheet.columnCount },
  };

  const metaSheet = workbook.addWorksheet("Report Info");
  metaSheet.columns = [
    { header: "Field", key: "field", width: 22 },
    { header: "Value", key: "value", width: 40 },
  ];

  metaSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  metaSheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0F172A" },
  };

  Object.entries(meta).forEach(([field, value]) => {
    metaSheet.addRow({ field, value: String(value ?? "-") });
  });

  return workbook.xlsx.writeBuffer();
}

router.get("/summary", async (req, res) => {
  try {
    const user = await getActor(req);
    const month = Number(req.query.month) || new Date().getMonth() + 1;
    const year = Number(req.query.year) || new Date().getFullYear();
    const date = req.query.date || new Date().toISOString().slice(0, 10);

    if (!user) {
      return res.status(404).json({ message: "المستخدم غير موجود" });
    }

    const [employees, allRecords, adjustments, projectsMap, packagesMap] =
      await Promise.all([
        getScopedEmployeesForUserRepo(user),
        listAttendanceRecordsRepo(),
        listAttendanceAdjustmentsRepo(),
        getProjectsMap(),
        getPackagesMap(),
      ]);

    const records = getScopedAttendance(employees, allRecords);

    const monthlyRows = buildMonthlyRows(
      employees,
      records,
      month,
      year,
      projectsMap,
      packagesMap
    );

    const dailyRows = buildDailyRows(
      employees,
      records,
      date,
      projectsMap,
      packagesMap
    );

    const issuesRows = buildIssuesRows(
      employees,
      records,
      month,
      year,
      projectsMap,
      packagesMap
    );

    const requestsRows = buildRequestsRows(user, employees, adjustments);

    const summary = {
      visibleEmployees: employees.length,
      monthlyHours: Number(
        monthlyRows.reduce((sum, row) => sum + Number(row.totalHours || 0), 0).toFixed(2)
      ),
      absentDays: monthlyRows.reduce((sum, row) => sum + Number(row.absentCount || 0), 0),
      singlePunchCount: monthlyRows.reduce(
        (sum, row) => sum + Number(row.singlePunchCount || 0),
        0
      ),
      leaveDays: monthlyRows.reduce((sum, row) => sum + Number(row.leaveCount || 0), 0),
      pendingRequests: requestsRows.filter((row) => row.status === "pending").length,
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

    return res.status(500).json({
      message: "فشل تحميل ملخص التقارير",
      error: error.message,
    });
  }
});

router.get("/export", async (req, res) => {
  try {
    const type = String(req.query.type || "monthly").trim();
    const user = await getActor(req);
    const month = Number(req.query.month) || new Date().getMonth() + 1;
    const year = Number(req.query.year) || new Date().getFullYear();
    const date = req.query.date || new Date().toISOString().slice(0, 10);

    if (!user) {
      return res.status(404).json({ message: "المستخدم غير موجود" });
    }

    const [employees, allRecords, adjustments, projectsMap, packagesMap] =
      await Promise.all([
        getScopedEmployeesForUserRepo(user),
        listAttendanceRecordsRepo(),
        listAttendanceAdjustmentsRepo(),
        getProjectsMap(),
        getPackagesMap(),
      ]);

    const records = getScopedAttendance(employees, allRecords);

    const rowsByType = {
      monthly: buildMonthlyRows(
        employees,
        records,
        month,
        year,
        projectsMap,
        packagesMap
      ),
      daily: buildDailyRows(
        employees,
        records,
        date,
        projectsMap,
        packagesMap
      ),
      issues: buildIssuesRows(
        employees,
        records,
        month,
        year,
        projectsMap,
        packagesMap
      ),
      requests: buildRequestsRows(user, employees, adjustments),
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

    return res.status(500).json({
      message: "فشل تصدير التقرير",
      error: error.message,
    });
  }
});

export default router;
