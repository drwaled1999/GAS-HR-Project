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

function getEmployeeGasId(employee) {
  return String(employee?.gasId || employee?.gas_id || "").trim();
}

function getRecordEmployeeValue(record) {
  return String(
    record?.employeeId ||
      record?.employee_id ||
      record?.employeeCode ||
      record?.employee_code ||
      record?.gasId ||
      record?.gas_id ||
      ""
  ).trim();
}

function getRecordDate(record) {
  return normalizeDate(record?.date || record?.workDate || record?.work_date);
}

function matchEmployeeRecord(employee, record, date) {
  const recordDate = getRecordDate(record);
  if (recordDate !== date) return false;

  const employeeUuid = String(employee?.id || "").trim();
  const employeeGasId = getEmployeeGasId(employee);
  const recordEmployeeValue = getRecordEmployeeValue(record);

  return (
    recordEmployeeValue === employeeUuid ||
    recordEmployeeValue === employeeGasId
  );
}

function getScopedAttendance(employees, records) {
  const employeeIds = new Set(employees.map((e) => String(e.id)));
  const gasIds = new Set(
    employees.map((e) => getEmployeeGasId(e)).filter(Boolean)
  );

  return records.filter((record) => {
    const value = getRecordEmployeeValue(record);
    return employeeIds.has(value) || gasIds.has(value);
  });
}

function findRecordForEmployeeDate(employee, records, date) {
  return records.find((record) => matchEmployeeRecord(employee, record, date));
}

function isWeekend(date) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 5 || day === 6;
}

function hasImportedRecordsForDate(records, date) {
  return records.some((record) => getRecordDate(record) === date);
}

function normalizeStatus(status) {
  const s = String(status || "").trim().toLowerCase();

  if (!s) return "";
  if (s === "p" || s === "present") return "Present";
  if (s === "a" || s === "absent") return "Absent";
  if (s === "sp" || s === "single punch") return "Single Punch";
  if (s.includes("annual")) return "Annual Leave";
  if (s.includes("sick")) return "Sick Leave";
  if (s.includes("emergency")) return "Emergency Leave";
  if (s.includes("leave")) return "Leave";

  return status;
}

function getRecordStatus(record) {
  return normalizeStatus(record?.status || "Present");
}

function getRecordHours(record) {
  return Number(record?.hours || 0);
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

      if (isWeekend(date)) continue;

      // لا تحسب غياب إذا هذا اليوم ما تم رفعه أصلاً في البصمة
      if (!hasImportedRecordsForDate(records, date)) continue;

      const record = findRecordForEmployeeDate(employee, records, date);

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
      } else {
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
  const importedDate = hasImportedRecordsForDate(records, date);

  return employees.map((employee) => {
    const record = findRecordForEmployeeDate(employee, records, date);

    return {
      employeeId: employee.id,
      name: employee.name,
      gasId: employee.gasId,
      nationality: employee.nationality,
      project: projectsMap.get(String(employee.projectId)) || "-",
      package: packagesMap.get(String(employee.packageId)) || "-",
      status: record ? getRecordStatus(record) : importedDate ? "Absent" : "Not Imported",
      hours: Number(getRecordHours(record).toFixed(2)),
      source: record?.source || "system",
      isModified: Boolean(record?.isModified),
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

      if (isWeekend(date)) continue;
      if (!hasImportedRecordsForDate(records, date)) continue;

      const record = findRecordForEmployeeDate(employee, records, date);
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
          source: record?.source || "system",
        });
      }
    }
  }

  return rows;
}

function buildRequestsRows(user, employees, adjustments) {
  const employeeIds = new Set(employees.map((e) => String(e.id)));
  const gasIds = new Set(
    employees.map((e) => getEmployeeGasId(e)).filter(Boolean)
  );

  let requests = adjustments.filter((r) => {
    const value = String(r.employeeId || "").trim();
    return employeeIds.has(value) || gasIds.has(value);
  });

  if (["Engineer", "Supervisor"].includes(String(user?.jobTitle || ""))) {
    requests = requests.filter(
      (r) => String(r.requestedById || "") === String(user.id)
    );
  }

  const employeeMapById = new Map(
    employees.map((employee) => [String(employee.id), employee])
  );

  const employeeMapByGasId = new Map(
    employees.map((employee) => [getEmployeeGasId(employee), employee])
  );

  return requests.map((item) => {
    const employee =
      employeeMapById.get(String(item.employeeId)) ||
      employeeMapByGasId.get(String(item.employeeId));

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
  sheet.columns = headers.map(([header, key]) => ({ header, key, width: 20 }));

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
      absentDays: monthlyRows.reduce(
        (sum, row) => sum + Number(row.absentCount || 0),
        0
      ),
      singlePunchCount: monthlyRows.reduce(
        (sum, row) => sum + Number(row.singlePunchCount || 0),
        0
      ),
      leaveDays: monthlyRows.reduce(
        (sum, row) => sum + Number(row.leaveCount || 0),
        0
      ),
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
    return res.status(500).json({
      message: "فشل تحميل ملخص التقارير",
      error: error.message,
    });
  }
});

router.get("/export", async (req, res) => {
  try {
    const type = req.query.type || "monthly";
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
