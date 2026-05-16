import express from "express";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
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
function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatMonthTitle(month, year) {
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleString("en-US", { month: "long", year: "numeric" });
}

function formatDayLabel(day) {
  return String(day?.day || "").padStart(2, "0");
}

function formatCellValue(cell) {
  const value = String(cell?.value ?? "").trim();
  if (!value) return "";
  return value;
}

function calculateRegHours(employee) {
  const total = Number(employee?.totalHours || 0);
  const ot = calculateOtHours(employee);
  return Math.max(total - ot, 0);
}

function calculateOtHours(employee) {
  const cells = Array.isArray(employee?.cells) ? employee.cells : [];
  return cells.reduce((sum, cell) => {
    const hours = Number(cell?.hours || 0);
    if (!Number.isFinite(hours) || hours <= 0) return sum;
    return sum + Math.max(hours - 10, 0);
  }, 0);
}

function formatHours(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return "0.0";
  return number.toFixed(1);
}

function chunkArray(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function getProjectTitle(report, queryProjectName) {
  const first = report?.employees?.[0];
  return queryProjectName || first?.project || "";
}

function buildOfficialTimesheetHtml({ report, query }) {
  const days = Array.isArray(report?.days) ? report.days : [];
  const employees = Array.isArray(report?.employees) ? report.employees : [];
  const pages = chunkArray(employees, 34);

  const monthTitle = formatMonthTitle(report.month, report.year);
  const projectName = getProjectTitle(report, query.projectName);

  const totalReg = employees.reduce((sum, emp) => sum + calculateRegHours(emp), 0);
  const totalOt = employees.reduce((sum, emp) => sum + calculateOtHours(emp), 0);
  const totalHours = employees.reduce((sum, emp) => sum + Number(emp.totalHours || 0), 0);
  const totalDays = employees.reduce((sum, emp) => sum + Number(emp.workingDays || 0), 0);

  const dayHeaders = days.map((day) => `<th class="day-col">${formatDayLabel(day)}</th>`).join("");

  function renderHeader() {
    return `
      <div class="doc-header">
        <div class="brand">
          <img src="https://gas-hr-project-1.onrender.com/logo.svg" />
          <div>
            <h1>Time Sheet for the Month of : ${escapeHtml(monthTitle)}</h1>
            <h2>${escapeHtml(projectName || "")}</h2>
          </div>
        </div>

        <table class="meta-table">
          <tr>
            <td>Customer Name :</td>
            <td>${escapeHtml(query.customerName || "")}</td>
          </tr>
          <tr>
            <td>Project Name :</td>
            <td>${escapeHtml(projectName || "")}</td>
          </tr>
          <tr>
            <td>PO Number# :</td>
            <td>${escapeHtml(query.poNumber || "")}</td>
          </tr>
          <tr>
            <td>Project Code :</td>
            <td>${escapeHtml(query.projectCode || "")}</td>
          </tr>
        </table>
      </div>
    `;
  }

  function renderSignatures() {
    return `
      <div class="signatures">
        <div><strong>Prepared By:</strong></div>
        <div><strong>Approved By:</strong></div>
        <div><strong>Checked By:</strong></div>
        <div><strong>Reviewed By:</strong></div>
      </div>
    `;
  }

  function renderTable(pageEmployees, pageIndex) {
    const rows = pageEmployees
      .map((emp, index) => {
        const sn = pageIndex * 34 + index + 1;
        const regHours = calculateRegHours(emp);
        const otHours = calculateOtHours(emp);

        const cells = days
          .map((day, dayIndex) => {
            const cell = emp.cells?.[dayIndex];
            return `<td class="day-cell ${escapeHtml(cell?.type || "")}">${escapeHtml(formatCellValue(cell))}</td>`;
          })
          .join("");

        return `
          <tr>
            <td class="sn">${sn}</td>
            <td class="name">${escapeHtml(emp.employeeName || "")}</td>
            <td class="designation">${escapeHtml(emp.designation || emp.jobTitle || "")}</td>
            <td class="gas-id">${escapeHtml(emp.gasId || emp.employeeCode || "")}</td>
            <td class="agent">${emp.employeeType === "rental" ? "Rental" : "GAS PV"}</td>
            ${cells}
            <td class="num">${formatHours(regHours)}</td>
            <td class="num">${formatHours(otHours)}</td>
            <td class="num">${formatHours(emp.totalHours)}</td>
            <td class="num">${escapeHtml(emp.workingDays || 0)}</td>
          </tr>
        `;
      })
      .join("");

    const isLastPage = pageIndex === pages.length - 1;

    return `
      <table class="timesheet-table">
        <thead>
          <tr>
            <th class="sn">SN</th>
            <th class="name">Full Name</th>
            <th class="designation">Designation</th>
            <th class="gas-id">GAS ID #</th>
            <th class="agent">Agent</th>
            ${dayHeaders}
            <th class="num">Reg.Hrs</th>
            <th class="num">OT Hrs</th>
            <th class="num">TotalHrs</th>
            <th class="num">Total Days</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
          ${
            isLastPage
              ? `
              <tr class="total-row">
                <td colspan="${5 + days.length}">Total</td>
                <td>${formatHours(totalReg)}</td>
                <td>${formatHours(totalOt)}</td>
                <td>${formatHours(totalHours)}</td>
                <td>${escapeHtml(totalDays)}</td>
              </tr>
              `
              : ""
          }
        </tbody>
      </table>
    `;
  }

  const pagesHtml = pages
    .map(
      (pageEmployees, index) => `
        <section class="pdf-page">
          ${index === 0 ? renderHeader() : renderSignatures()}
          ${renderTable(pageEmployees, index)}
          ${index === pages.length - 1 ? renderSignatures() : ""}
        </section>
      `
    )
    .join("");

  return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Official Timesheet</title>
  <style>
    @page {
      size: A3 landscape;
      margin: 8mm;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      font-family: Arial, Helvetica, sans-serif;
      color: #000;
      background: #fff;
      font-size: 8px;
    }

    .pdf-page {
      page-break-after: always;
    }

    .pdf-page:last-child {
      page-break-after: auto;
    }

    .doc-header {
      display: grid;
      grid-template-columns: 1fr 360px;
      gap: 12px;
      margin-bottom: 8px;
      align-items: start;
    }

    .brand {
      display: flex;
      gap: 12px;
      align-items: center;
    }

    .brand img {
      width: 95px;
      height: 60px;
      object-fit: contain;
    }

    .brand h1 {
      margin: 0;
      font-size: 16px;
      font-weight: 700;
    }

    .brand h2 {
      margin: 4px 0 0;
      font-size: 12px;
      font-weight: 700;
    }

    .meta-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
      font-weight: 700;
    }

    .meta-table td {
      border: 1px solid #000;
      padding: 4px 6px;
      height: 22px;
    }

    .meta-table td:first-child {
      width: 120px;
      background: #f2f2f2;
    }

    .timesheet-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }

    .timesheet-table th,
    .timesheet-table td {
      border: 1px solid #000;
      padding: 2px 2px;
      text-align: center;
      vertical-align: middle;
      line-height: 1.05;
      height: 16px;
      overflow: hidden;
      word-break: break-word;
    }

    .timesheet-table th {
      background: #e5e5e5;
      font-weight: 700;
      font-size: 7.5px;
    }

    .timesheet-table td {
      font-size: 7.3px;
      font-weight: 600;
    }

    .sn {
      width: 22px;
    }

    .name {
      width: 110px;
      text-align: left !important;
      font-weight: 700;
    }

    .designation {
      width: 82px;
      text-align: left !important;
    }

    .gas-id {
      width: 48px;
    }

    .agent {
      width: 70px;
    }

    .day-col,
    .day-cell {
      width: 20px;
    }

    .num {
      width: 42px;
      font-weight: 700;
    }

    .day-cell.weekend {
      background: #f0f0f0;
      font-weight: 700;
    }

    .day-cell.absent {
      color: #000;
      font-weight: 800;
    }

    .day-cell.single_punch {
      background: #fff2cc;
      font-weight: 800;
    }

    .total-row td {
      height: 22px;
      font-size: 9px;
      font-weight: 800;
      background: #f2f2f2;
    }

    .total-row td:first-child {
      text-align: right;
      padding-right: 10px;
    }

    .signatures {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 120px;
      margin: 4px 0 8px;
      font-size: 10px;
    }

    .signatures div {
      min-height: 20px;
      padding-top: 4px;
    }
  </style>
</head>
<body>
  ${pagesHtml || `<section class="pdf-page">${renderHeader()}<div>No data found</div></section>`}
</body>
</html>
`;
}

async function buildTimesheetReportFromQuery(reqQuery) {
  const {
    month,
    year,
    source = "auto",
    projectKey = "",
    projectName = "",
    packageName = "",
    employeeType = "all",
    search = "",
  } = reqQuery;

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

    if (rows.length) usedSource = "project";
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

    if (rows.length) usedSource = "general";
  }

  return buildTimesheetReport({
    rows,
    month,
    year,
    source: usedSource,
  });
}

router.get("/official-pdf", async (req, res) => {
  let browser;

  try {
    if (!canViewTimesheetReports(req.user)) {
      return res.status(403).json({
        message: "You do not have permission to export timesheet reports",
      });
    }

    const { month, year } = req.query;

    if (!month || !year) {
      return res.status(400).json({
        message: "Month and year are required",
      });
    }

    const report = await buildTimesheetReportFromQuery(req.query);
    const html = buildOfficialTimesheetHtml({
      report,
      query: req.query,
    });

    browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    });

    const page = await browser.newPage();

    await page.setContent(html, {
      waitUntil: "networkidle0",
      timeout: 120000,
    });

    const pdfBuffer = await page.pdf({
      format: "A3",
      landscape: true,
      printBackground: true,
      margin: {
        top: "8mm",
        right: "8mm",
        bottom: "8mm",
        left: "8mm",
      },
    });

    const fileName = `Official_Timesheet_${month}_${year}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Content-Length", pdfBuffer.length);

    return res.end(pdfBuffer);
  } catch (error) {
    console.error("🔥 Official timesheet PDF error:", error);

    return res.status(500).json({
      message: "Failed to generate official timesheet PDF",
      error: error?.message || "Unknown server error",
    });
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
});

export default router;
