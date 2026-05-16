import express from "express";
import { query } from "../data/index.js";
import { requireAuth } from "../middleware_auth.js";

const router = express.Router();

router.use(requireAuth);

function normalizeRole(value) {
  return String(value || "").trim().toLowerCase();
}

function getCurrentRole(user) {
  return normalizeRole(user?.roleName || user?.role || user?.roleCode);
}

function canViewTimesheetReports(user) {
  const role = getCurrentRole(user);

  return [
    "system owner",
    "owner",
    "system_owner",
    "hr manager",
    "hr_manager",
    "hr admin",
    "hr_admin",
    "hr",
    "admin",
    "admin assistant",
    "admin_assistant",
    "cm",
    "project manager",
    "project_manager",
  ].includes(role);
}

function normalizeDate(value) {
  if (!value) return null;

  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) return date;

  return null;
}

function toDateKey(value) {
  const date = normalizeDate(value);
  if (!date) return "";

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}`;
}

function getMonthDays(month, year) {
  const days = [];
  const lastDay = new Date(Number(year), Number(month), 0).getDate();

  for (let day = 1; day <= lastDay; day += 1) {
    const date = new Date(Number(year), Number(month) - 1, day, 12, 0, 0);
    const key = toDateKey(date);

    days.push({
      key,
      day,
      label: String(day),
      weekend: date.getDay() === 5 || date.getDay() === 6,
    });
  }

  return days;
}

function parseHours(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return Math.round(number);
}

function getEmployeeType(employeeCode) {
  const code = String(employeeCode || "").trim();

  if (!code) return "unknown";

  if (code.length > 7) return "rental";
  if (code.length <= 7) return "gas";

  return "unknown";
}

function matchEmployeeType(row, employeeType) {
  if (!employeeType || employeeType === "all") return true;

  const type = getEmployeeType(row.employee_code);

  if (employeeType === "gas") return type === "gas";
  if (employeeType === "rental") return type === "rental";
  if (employeeType === "unknown") return type === "unknown";

  return true;
}

function classifyCell(row) {
  const overrideType = String(row.override_type || "").trim();
  const exception = String(row.exception_text || "").trim().toLowerCase();
  const leave = String(row.leave_text || "").trim().toLowerCase();
  const hours = parseHours(row.regular_hours);

  if (overrideType) {
    if (overrideType === "present") return { value: String(hours || 8), type: "hours", hours: hours || 8 };
    if (overrideType === "takleef") return { value: "TK", type: "takleef", hours: 0 };
    if (overrideType === "annual_leave") return { value: "AL", type: "annual_leave", hours: 0 };
    if (overrideType === "sick_leave") return { value: "SL", type: "sick_leave", hours: 0 };
    if (overrideType === "emergency_leave") return { value: "EL", type: "emergency_leave", hours: 0 };
    if (overrideType === "permission") return { value: "PM", type: "permission", hours: 0 };
    if (overrideType === "absent") return { value: "A", type: "absent", hours: 0 };
    if (overrideType === "weekend") return { value: "OFF", type: "weekend", hours: 0 };
  }

  if (leave.includes("sick")) return { value: "SL", type: "sick_leave", hours: 0 };
  if (leave.includes("emergency")) return { value: "EL", type: "emergency_leave", hours: 0 };
  if (leave.includes("annual")) return { value: "AL", type: "annual_leave", hours: 0 };
  if (leave.includes("permission")) return { value: "PM", type: "permission", hours: 0 };
  if (leave.includes("takleef") || leave.includes("task")) return { value: "TK", type: "takleef", hours: 0 };

  if (exception.includes("absence")) return { value: "A", type: "absent", hours: 0 };
  if (exception.includes("missing punch")) return { value: "SP", type: "single_punch", hours: 0 };

  if (hours > 0) return { value: String(hours), type: "hours", hours };

  return { value: "", type: "normal", hours: 0 };
}

function buildTimesheetReport({ rows, month, year, source }) {
  const days = getMonthDays(month, year);
  const employeesMap = new Map();

  rows.forEach((row) => {
    const employeeCode = String(row.employee_code || "").trim();
    const employeeName = String(row.employee_name || "").trim();

    if (!employeeName) return;

    const key = `${employeeCode}__${employeeName}`;

    if (!employeesMap.has(key)) {
      employeesMap.set(key, {
        employeeCode,
        employeeName,
        gasId: employeeCode || "-",
        employeeType: getEmployeeType(employeeCode),
        project: row.project_name || row.batch_project_name || "-",
        package: row.package_name || "-",
        nationality: row.employee_nationality || "-",
        byDay: {},
        totalHours: 0,
        workingDays: 0,
        absent: 0,
        singlePunch: 0,
        annualLeave: 0,
        sickLeave: 0,
        emergencyLeave: 0,
        permission: 0,
        takleef: 0,
      });
    }

    const employee = employeesMap.get(key);
    const dateKey = toDateKey(row.work_date);
    const cell = classifyCell(row);

    employee.byDay[dateKey] = cell;

    if (cell.type === "hours") {
      employee.totalHours += Number(cell.hours || 0);
      employee.workingDays += 1;
    }

    if (cell.type === "absent") employee.absent += 1;
    if (cell.type === "single_punch") employee.singlePunch += 1;
    if (cell.type === "annual_leave") employee.annualLeave += 1;
    if (cell.type === "sick_leave") employee.sickLeave += 1;
    if (cell.type === "emergency_leave") employee.emergencyLeave += 1;
    if (cell.type === "permission") employee.permission += 1;
    if (cell.type === "takleef") employee.takleef += 1;
  });

  const employees = Array.from(employeesMap.values()).map((employee) => {
    const cells = days.map((day) => {
      const existing = employee.byDay[day.key];

      if (existing) return existing;

      if (day.weekend) {
        return {
          value: "OFF",
          type: "weekend",
          hours: 0,
        };
      }

      return {
        value: "A",
        type: "absent",
        hours: 0,
      };
    });

    const missingAbsent = cells.filter((cell) => cell.type === "absent").length;

    return {
      ...employee,
      cells,
      absent: missingAbsent,
      totalHours: Math.round(employee.totalHours),
    };
  });

  const summary = employees.reduce(
    (acc, employee) => {
      acc.totalEmployees += 1;
      acc.totalHours += Number(employee.totalHours || 0);
      acc.workingDays += Number(employee.workingDays || 0);
      acc.absent += Number(employee.absent || 0);
      acc.singlePunch += Number(employee.singlePunch || 0);
      acc.annualLeave += Number(employee.annualLeave || 0);
      acc.sickLeave += Number(employee.sickLeave || 0);
      acc.emergencyLeave += Number(employee.emergencyLeave || 0);
      acc.permission += Number(employee.permission || 0);
      acc.takleef += Number(employee.takleef || 0);

      if (employee.employeeType === "gas") acc.gasEmployees += 1;
      if (employee.employeeType === "rental") acc.rentalEmployees += 1;

      return acc;
    },
    {
      totalEmployees: 0,
      gasEmployees: 0,
      rentalEmployees: 0,
      totalHours: 0,
      workingDays: 0,
      absent: 0,
      singlePunch: 0,
      annualLeave: 0,
      sickLeave: 0,
      emergencyLeave: 0,
      permission: 0,
      takleef: 0,
    }
  );

  return {
    source,
    month: Number(month),
    year: Number(year),
    days,
    employees,
    summary,
  };
}

async function getProjectAttendanceRows({ month, year, projectKey, packageName, employeeType, search }) {
  const params = [Number(month), Number(year)];
  let where = `
    WHERE ab.month_int = $1
      AND ab.year_int = $2
      AND ab.status = 'approved'
      AND ab.visible_to_employees = true
  `;

  if (projectKey) {
    params.push(String(projectKey).trim());
    where += ` AND ab.project_key = $${params.length}`;
  }

  if (packageName) {
    params.push(String(packageName).trim());
    where += ` AND COALESCE(emp.package_name, '') = $${params.length}`;
  }

  if (search) {
    params.push(`%${String(search).trim()}%`);
    where += ` AND (
      ar.employee_name ILIKE $${params.length}
      OR ar.employee_code ILIKE $${params.length}
      OR COALESCE(emp.project_name, '') ILIKE $${params.length}
      OR COALESCE(emp.package_name, '') ILIKE $${params.length}
    )`;
  }

  const result = await query(
    `
    SELECT
      ar.*,
      emp.nationality AS employee_nationality,
      emp.project_name,
      emp.package_name,
      ab.project_key,
      ab.project_name AS batch_project_name
    FROM project_attendance_records ar
    JOIN project_attendance_batches ab
      ON ab.id = ar.import_batch_id
    LEFT JOIN employees emp
      ON emp.gas_id = ar.employee_code
      OR emp.full_name = ar.employee_name
    ${where}
    ORDER BY ar.employee_name ASC, ar.work_date ASC
    `,
    params
  );

  return result.rows.filter((row) => matchEmployeeType(row, employeeType));
}

async function getGeneralAttendanceRows({ month, year, projectName, packageName, employeeType, search }) {
  const params = [Number(month), Number(year)];
  let where = `
    WHERE ab.month_int = $1
      AND ab.year_int = $2
      AND ab.status = 'approved'
      AND ab.visible_to_employees = true
  `;

  if (projectName) {
    params.push(String(projectName).trim());
    where += ` AND COALESCE(emp.project_name, '') = $${params.length}`;
  }

  if (packageName) {
    params.push(String(packageName).trim());
    where += ` AND COALESCE(emp.package_name, '') = $${params.length}`;
  }

  if (search) {
    params.push(`%${String(search).trim()}%`);
    where += ` AND (
      ar.employee_name ILIKE $${params.length}
      OR ar.employee_code ILIKE $${params.length}
      OR COALESCE(emp.project_name, '') ILIKE $${params.length}
      OR COALESCE(emp.package_name, '') ILIKE $${params.length}
    )`;
  }

  const result = await query(
    `
    SELECT
      ar.*,
      emp.nationality AS employee_nationality,
      emp.project_name,
      emp.package_name
    FROM attendance_records ar
    JOIN attendance_import_batches ab
      ON ab.id = ar.import_batch_id
    LEFT JOIN employees emp
      ON emp.gas_id = ar.employee_code
      OR emp.full_name = ar.employee_name
    ${where}
    ORDER BY ar.employee_name ASC, ar.work_date ASC
    `,
    params
  );

  return result.rows.filter((row) => matchEmployeeType(row, employeeType));
}

router.get("/generate", async (req, res) => {
  try {
    if (!canViewTimesheetReports(req.user)) {
      return res.status(403).json({
        message: "You do not have permission to view timesheet reports",
      });
    }

    const {
      month,
      year,
      source = "auto",
      projectKey = "",
      projectName = "",
      packageName = "",
      employeeType = "all",
      search = "",
    } = req.query;

    if (!month || !year) {
      return res.status(400).json({
        message: "Month and year are required",
      });
    }

    let rows = [];
    let usedSource = source;

    if (source === "project" || source === "auto") {
      rows = await getProjectAttendanceRows({
        month,
        year,
        projectKey,
        packageName,
        employeeType,
        search,
      });

      if (rows.length) {
        usedSource = "project";
      }
    }

    if (!rows.length && (source === "general" || source === "auto")) {
      rows = await getGeneralAttendanceRows({
        month,
        year,
        projectName,
        packageName,
        employeeType,
        search,
      });

      if (rows.length) {
        usedSource = "general";
      }
    }

    const report = buildTimesheetReport({
      rows,
      month,
      year,
      source: usedSource,
    });

    return res.json({
      message: rows.length
        ? "Timesheet report generated successfully"
        : "No approved attendance data found for the selected filters",
      report,
    });
  } catch (error) {
    console.error("🔥 Generate timesheet report error:", error);

    return res.status(500).json({
      message: "Failed to generate timesheet report",
      error: error?.message || "Unknown server error",
    });
  }
});

export default router;
