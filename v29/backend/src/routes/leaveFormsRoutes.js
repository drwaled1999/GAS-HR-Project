import express from "express";
import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { query } from "../data/index.js";
import { requireAuth } from "../middleware_auth.js";

const router = express.Router();
router.use(requireAuth);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function normalizeRole(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "_");
}

function canViewLeaveForms(user) {
  const role = normalizeRole(user?.roleCode || user?.role || user?.roleName);
  const permissions = Array.isArray(user?.permissions)
    ? user.permissions.map((item) => String(item || "").trim().toLowerCase())
    : [];

  return (
    [
      "owner",
      "system_owner",
      "hr_manager",
      "hr_admin",
      "hr",
      "admin",
      "admin_assistant",
      "site_admin",
      "project_manager",
      "cm",
    ].includes(role) || permissions.includes("leave_forms_view")
  );
}

function toNullableInteger(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);

  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();

  return `${dd}-${mm}-${yyyy}`;
}

function calcDays(startDate, endDate) {
  if (!startDate || !endDate) return 0;

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;

  const diff = Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
  return diff > 0 ? diff : 0;
}

function labelLeaveType(type) {
  const value = String(type || "").toLowerCase();

  if (value === "annual_leave") return "Annual Leave";
  if (value === "emergency_leave") return "Emergency Leave";
  if (value === "sick_leave") return "Sick Leave";
  if (value === "unpaid_leave") return "Unpaid Leave";

  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function checkMark(condition) {
  return condition ? "✓" : "";
}

function getGasLogoDataUri() {
  try {
    const logoPath = path.join(__dirname, "..", "assets", "GAS-Logo.jpg");

    if (!fs.existsSync(logoPath)) {
      console.error("GAS logo file not found:", logoPath);
      return "";
    }

    const imageBuffer = fs.readFileSync(logoPath);
    const encoded = imageBuffer.toString("base64");

    return `data:image/jpeg;base64,${encoded}`;
  } catch (error) {
    console.error("GAS logo not found for leave form PDF:", error.message);
    return "";
  }
}

async function ensureLeaveFormsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS leave_forms (
      id SERIAL PRIMARY KEY,
      request_id INTEGER NOT NULL UNIQUE,
      employee_id INTEGER NULL,
      generated_by INTEGER NULL,
      generated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
}

async function upsertLeaveFormRecord({ requestId, employeeId, generatedBy }) {
  await ensureLeaveFormsTable();

  const safeRequestId = toNullableInteger(requestId);
  const safeEmployeeId = toNullableInteger(employeeId);
  const safeGeneratedBy = toNullableInteger(generatedBy);

  if (!safeRequestId) {
    throw new Error("Invalid leave request id");
  }

  await query(
    `
    INSERT INTO leave_forms (
      request_id,
      employee_id,
      generated_by,
      generated_at,
      updated_at
    )
    VALUES (
      $1::integer,
      $2::integer,
      $3::integer,
      NOW(),
      NOW()
    )
    ON CONFLICT (request_id)
    DO UPDATE SET
      employee_id = EXCLUDED.employee_id,
      generated_by = EXCLUDED.generated_by,
      generated_at = NOW(),
      updated_at = NOW()
    `,
    [safeRequestId, safeEmployeeId, safeGeneratedBy]
  );
}

async function getLeaveFormByRequestId(requestId) {
  const safeRequestId = toNullableInteger(requestId);

  if (!safeRequestId) {
    return null;
  }

  const result = await query(
    `
    SELECT
      lr.id AS "requestId",
      lr.employee_id AS "employeeId",
      COALESCE(lr.employee_gas_id, e.gas_id) AS "employeeGasId",
      COALESCE(lr.employee_name, e.full_name) AS "employeeName",
      COALESCE(e.project_name, '') AS "projectName",
      COALESCE(e.package_name, '') AS "packageName",
      COALESCE(e.job_title, '') AS "position",
      lr.type,
      lr.status,
      lr.start_date AS "startDate",
      lr.end_date AS "endDate",
      lr.note,
      lr.created_at AS "requestDate",
      lr.reviewer_name AS "reviewerName",
      lr.reviewed_at AS "reviewedAt",
      COALESCE(lr.employee_name, e.full_name, '') AS "requestedByName",
      COALESCE(lb.annual_balance, lb.balance, 30) AS "annualBalance",
      COALESCE(lb.annual_used, 0) AS "annualUsed",
      COALESCE(lb.sick_balance, 15) AS "sickBalance",
      COALESCE(lb.sick_used, 0) AS "sickUsed",
      COALESCE(lb.emergency_balance, 5) AS "emergencyBalance",
      COALESCE(lb.emergency_used, 0) AS "emergencyUsed",
      lf.id AS "formId",
      lf.generated_at AS "generatedAt"
    FROM leave_requests lr
    LEFT JOIN employees e ON e.id = lr.employee_id
    LEFT JOIN leave_balances lb ON lb.employee_id = lr.employee_id
    LEFT JOIN leave_forms lf ON lf.request_id = lr.id
    WHERE lr.id = $1::integer
      AND LOWER(lr.status) = 'approved'
      AND lr.type IN ('annual_leave', 'emergency_leave', 'sick_leave', 'unpaid_leave')
    LIMIT 1
    `,
    [safeRequestId]
  );

  return result.rows[0] || null;
}

function getBalanceInfo(form) {
  const type = String(form?.type || "").toLowerCase();
  const days = calcDays(form?.startDate, form?.endDate);

  if (type === "sick_leave") {
    const total = Number(form?.sickBalance || 0);
    const used = Number(form?.sickUsed || 0);
    return { total, used, remaining: Math.max(total - used, 0), days };
  }

  if (type === "emergency_leave") {
    const total = Number(form?.emergencyBalance || 0);
    const used = Number(form?.emergencyUsed || 0);
    return { total, used, remaining: Math.max(total - used, 0), days };
  }

  const total = Number(form?.annualBalance || 0);
  const used = Number(form?.annualUsed || 0);

  return { total, used, remaining: Math.max(total - used, 0), days };
}

function buildLeaveFormHtml(form) {
  const type = String(form?.type || "").toLowerCase();
  const balance = getBalanceInfo(form);
  const logoDataUri = getGasLogoDataUri();

  const isAnnual = type === "annual_leave";
  const isEmergency = type === "emergency_leave";
  const isSick = type === "sick_leave";
  const isUnpaid = type === "unpaid_leave";

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Leave Request Form</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 8mm;
    }

    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    body {
      margin: 0;
      background: #ffffff;
      color: #000;
      font-family: "Times New Roman", Times, serif;
      font-size: 11px;
      line-height: 1.15;
    }

    .page {
      width: 100%;
      max-width: 194mm;
      margin: 0 auto;
      min-height: 280mm;
      position: relative;
      padding-bottom: 18mm;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }

    td {
      border: 1px solid #000;
      padding: 4px 6px;
      vertical-align: middle;
      font-size: 11px;
    }

    .center { text-align: center; }
    .bold { font-weight: 700; }
    .upper { text-transform: uppercase; }

    .logo-cell {
      width: 20%;
      height: 68px;
      text-align: center;
      vertical-align: middle;
    }

    .gas-logo-img {
      width: 120px;
      max-width: 150px;
      max-height: 62px;
      object-fit: contain;
      display: block;
      margin: 0 auto;
    }

    .gas-fallback {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 28px;
      font-weight: 900;
      color: #007c89;
    }

    .title-cell {
      width: 51%;
      text-align: center;
      padding: 0;
    }

    .qms-title {
      font-size: 12px;
      font-weight: 700;
      height: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-bottom: 1px solid #000;
    }

    .form-title {
      font-size: 24px;
      font-weight: 700;
      height: 34px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-bottom: 1px solid #000;
    }

    .form-code {
      font-size: 12px;
      font-weight: 700;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .meta-label {
      width: 15%;
      font-weight: 700;
      font-size: 11px;
    }

    .meta-value {
      width: 14%;
      text-align: center;
      font-size: 11px;
    }

    .notice-top {
      text-align: center;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 7.2px;
      font-weight: 700;
      padding: 4px 0 6px;
    }

    .field-label {
      font-weight: 700;
      text-transform: uppercase;
      background: #f3f3f3;
    }

    .field-value {
      font-weight: 700;
      text-transform: uppercase;
    }

    .spacer {
      height: 12px;
    }

    .checkbox {
      display: inline-block;
      width: 13px;
      height: 13px;
      border: 1px solid #000;
      text-align: center;
      line-height: 12px;
      font-size: 12px;
      font-weight: 700;
      margin: 0 7px 0 0;
      vertical-align: middle;
      font-family: Arial, Helvetica, sans-serif;
    }

    .option {
      display: inline-block;
      min-width: 115px;
      white-space: nowrap;
    }

    .small-option {
      display: inline-block;
      min-width: 92px;
      white-space: nowrap;
    }

    .section-title {
      text-align: center;
      font-weight: 700;
      text-transform: uppercase;
      background: #f3f3f3;
      font-size: 12px;
    }

    .section-title em {
      font-size: 9px;
      font-style: italic;
      font-weight: 700;
    }

    .review-list {
      height: 104px;
      padding: 6px 10px;
      vertical-align: top;
    }

    .review-item {
      display: block;
      margin-bottom: 6px;
      white-space: nowrap;
    }

    .comments-box {
      height: 58px;
      vertical-align: top;
      white-space: pre-wrap;
      font-size: 11px;
    }

    .h20 td { height: 20px; }
    .h22 td { height: 22px; }

    .signature-title {
      background: #f3f3f3;
      font-weight: 700;
      text-transform: uppercase;
    }

    .signature-name {
      height: 70px;
      text-align: center;
      vertical-align: middle;
      font-weight: 700;
      text-transform: uppercase;
    }

    .signature-empty {
      height: 24px;
    }

    .footer {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      justify-content: space-between;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 8px;
      font-weight: 700;
    }

    .no-border {
      border: none !important;
    }
  </style>
</head>

<body>
  <div class="page">
    <table>
      <tr>
        <td rowspan="3" class="logo-cell">
          ${
            logoDataUri
              ? `<img class="gas-logo-img" src="${logoDataUri}" alt="GAS Logo" />`
              : `<div class="gas-fallback">GAS</div>`
          }
        </td>

        <td rowspan="3" class="title-cell">
          <div class="qms-title">QUALITY MANAGEMENT SYSTEM FORM</div>
          <div class="form-title">LEAVE REQUEST FORM</div>
          <div class="form-code">GAS-QMS-F-006-01</div>
        </td>

        <td class="meta-label">Date Revised</td>
        <td class="meta-value">31-05-2026</td>
      </tr>
      <tr>
        <td class="meta-label">Effective Date</td>
        <td class="meta-value">31-05-2026</td>
      </tr>
      <tr>
        <td class="meta-label">Rev./Issue No.</td>
        <td class="meta-value">01 / 00</td>
      </tr>
      <tr>
        <td class="no-border"></td>
        <td class="no-border"></td>
        <td class="meta-label">Page No.</td>
        <td class="meta-value">1 of 1</td>
      </tr>
    </table>

    <div class="notice-top">
      ANY MODIFICATION TO THIS DOCUMENT SHALL BE THROUGH CQMC ONLY. THINK DIGITAL. WORK SMART. SAVE PLANET.
    </div>

    <table>
      <tr class="h22">
        <td class="field-label" style="width:21%;">Employee No.</td>
        <td class="field-value center" style="width:31%;">${escapeHtml(form?.employeeGasId)}</td>
        <td class="field-label" style="width:19%;">Division</td>
        <td class="field-value" style="width:29%;">${escapeHtml(form?.projectName || "LEAVE")}</td>
      </tr>
      <tr class="h22">
        <td class="field-label">Employee Name</td>
        <td class="field-value">${escapeHtml(form?.employeeName)}</td>
        <td class="field-label">Position</td>
        <td class="field-value">${escapeHtml(form?.position || "")}</td>
      </tr>
    </table>

    <div class="spacer"></div>

    <table>
      <tr class="h22">
        <td class="field-label" style="width:17%;">Request Date</td>
        <td style="width:17%;">${formatDate(form?.requestDate)}</td>
        <td class="field-label" style="width:20%;">Leave Start Date</td>
        <td style="width:17%;">${formatDate(form?.startDate)}</td>
        <td class="field-label" style="width:18%;">Leave End Date</td>
        <td style="width:11%;">${formatDate(form?.endDate)}</td>
      </tr>
      <tr>
        <td class="field-label" style="height:62px;">Leave Type:</td>
        <td colspan="5">
          <div style="margin-bottom:12px;">
            <span class="option"><span class="checkbox">${checkMark(isAnnual)}</span>ANNUAL</span>
            <span class="option"><span class="checkbox">${checkMark(isUnpaid)}</span>UNPAID</span>
            <span class="option"><span class="checkbox">${checkMark(isEmergency)}</span>EMERGENCY</span>
          </div>
          <div>
            <span class="checkbox">${checkMark(isSick)}</span>OTHER:
            <span style="display:inline-block;width:170px;border-bottom:1px solid #000;margin-left:4px;">
              ${isSick ? "SICK LEAVE" : ""}
            </span>
          </div>
        </td>
      </tr>
    </table>

    <div class="spacer"></div>

    <table>
      <tr>
        <td class="section-title" colspan="2">
          LEAVE DETAILS <em>(TO BE FILLED BY REQUESTOR)</em>
        </td>
        <td class="section-title" colspan="2">
          REVIEW AND COMMENTS <em>(TO BE FILLED BY HRPM)</em>
        </td>
      </tr>
      <tr>
        <td class="field-label" style="width:30%;">Total Vacation Balance</td>
        <td style="width:17%;">${escapeHtml(balance.total)}</td>
        <td class="review-list" colspan="2" rowspan="5">
          <span class="review-item"><span class="checkbox">✓</span> LEAVE APPROVED</span>
          <span class="review-item"><span class="checkbox"></span> LEAVE NOT APPROVED</span>
          <span class="review-item"><span class="checkbox"></span> LEAVE RE-SCHEDULED</span>
          <span class="review-item"><span class="checkbox"></span> LEAVE APPROVED WITH CONDITION</span>
          <span class="review-item"><span class="checkbox">${checkMark(isUnpaid)}</span> LEAVE APPROVED (UNPAID)</span>
        </td>
      </tr>
      <tr>
        <td class="field-label">Number of Days Applied For</td>
        <td>${escapeHtml(balance.days)}</td>
      </tr>
      <tr>
        <td class="field-label">Total Leave Days</td>
        <td>${escapeHtml(balance.days)}</td>
      </tr>
      <tr>
        <td class="field-label">Balance of Unused Leave</td>
        <td>${escapeHtml(balance.remaining)}</td>
      </tr>
      <tr>
        <td class="field-label">Vacation Salary</td>
        <td>
          <span class="small-option"><span class="checkbox"></span>YES</span>
          <span class="small-option"><span class="checkbox"></span>NO</span>
        </td>
      </tr>
      <tr>
        <td class="field-label">Exit Re-Entry</td>
        <td>
          <span class="small-option"><span class="checkbox"></span>YES</span>
          <span class="small-option"><span class="checkbox"></span>NO</span>
        </td>
        <td colspan="2" rowspan="2" class="comments-box">
          Comments / Justification
          ${escapeHtml(form?.note || "")}
        </td>
      </tr>
      <tr>
        <td class="field-label">Ticket</td>
        <td>
          <span class="small-option"><span class="checkbox"></span>YES</span>
          <span class="small-option"><span class="checkbox"></span>NO</span>
        </td>
      </tr>
    </table>

    <div class="spacer"></div>

    <table>
      <tr class="h22">
        <td class="field-label" style="width:19%;">Travel Details</td>
        <td class="field-label center" style="width:27%;">Date</td>
        <td class="field-label center" style="width:27%;">From</td>
        <td class="field-label center" style="width:27%;">To</td>
      </tr>
      <tr class="h22">
        <td class="field-label">Departure</td>
        <td></td>
        <td></td>
        <td></td>
      </tr>
      <tr class="h22">
        <td class="field-label">Return</td>
        <td></td>
        <td></td>
        <td></td>
      </tr>
      <tr class="h22">
        <td class="field-label">Rejoining</td>
        <td></td>
        <td></td>
        <td></td>
      </tr>
    </table>

    <div class="spacer"></div>

    <table>
      <tr class="h22">
        <td class="section-title" colspan="4">
          THE “HOME CONTACT & ADDRESS” FOR THE DURATION OF THE LEAVE WILL BE
        </td>
      </tr>
      <tr class="h20">
        <td class="field-label" style="width:19%;">Telephone No.</td>
        <td style="width:31%;"></td>
        <td class="field-label" style="width:16%;">Mobile No.</td>
        <td style="width:34%;"></td>
      </tr>
      <tr class="h20">
        <td class="field-label">Address</td>
        <td colspan="3"></td>
      </tr>
    </table>

    <div class="spacer"></div>

    <table>
      <tr class="h22">
        <td class="section-title" colspan="4">
          THE “EMERGENCY CONTACT ADDRESS” FOR THE DURATION OF THE LEAVE WILL BE – FIRST-DEGREE RELATIVE
        </td>
      </tr>
      <tr class="h20">
        <td class="field-label" style="width:19%;">Telephone No.</td>
        <td style="width:31%;"></td>
        <td class="field-label" style="width:16%;">Mobile No.</td>
        <td style="width:34%;"></td>
      </tr>
      <tr class="h20">
        <td class="field-label">Address</td>
        <td colspan="3"></td>
      </tr>
    </table>

    <div class="spacer"></div>

    <table>
      <tr class="h22">
        <td class="signature-title" colspan="3">Initiator and Approvers</td>
      </tr>
      <tr class="h22">
        <td class="field-label center">Requested By</td>
        <td class="field-label center">Acknowledge By</td>
        <td class="field-label center">Approved By</td>
      </tr>
      <tr>
        <td class="signature-name">${escapeHtml(form?.requestedByName || form?.employeeName)}</td>
        <td class="signature-name"></td>
        <td class="signature-name">${escapeHtml(form?.reviewerName || "")}</td>
      </tr>
      <tr>
        <td class="signature-empty"></td>
        <td class="signature-empty"></td>
        <td class="signature-empty"></td>
      </tr>
    </table>

    <div class="footer">
      <span>ANY MODIFICATION TO THIS DOCUMENT SHALL BE THROUGH CQMC ONLY.</span>
      <span>THINK DIGITAL. WORK SMART. SAVE PLANET.</span>
    </div>
  </div>
</body>
</html>`;
}

router.get("/", async (req, res) => {
  try {
    if (!canViewLeaveForms(req.user)) {
      return res.status(403).json({
        message: "You do not have permission to view leave forms",
      });
    }

    await ensureLeaveFormsTable();

    const {
      search = "",
      project = "",
      packageName = "",
      type = "",
      month = "",
      year = "",
    } = req.query;

    const params = [];
    const where = [
      "LOWER(lr.status) = 'approved'",
      "lr.type IN ('annual_leave', 'emergency_leave', 'sick_leave', 'unpaid_leave')",
    ];

    if (search) {
      params.push(`%${String(search).trim()}%`);
      where.push(
        `(COALESCE(lr.employee_gas_id, e.gas_id) ILIKE $${params.length} OR COALESCE(lr.employee_name, e.full_name) ILIKE $${params.length})`
      );
    }

    if (project) {
      params.push(`%${String(project).trim()}%`);
      where.push(`COALESCE(e.project_name, '') ILIKE $${params.length}`);
    }

    if (packageName) {
      params.push(`%${String(packageName).trim()}%`);
      where.push(`COALESCE(e.package_name, '') ILIKE $${params.length}`);
    }

    if (type) {
      params.push(String(type).trim());
      where.push(`lr.type = $${params.length}`);
    }

    if (month) {
      params.push(Number(month));
      where.push(`EXTRACT(MONTH FROM lr.start_date)::int = $${params.length}`);
    }

    if (year) {
      params.push(Number(year));
      where.push(`EXTRACT(YEAR FROM lr.start_date)::int = $${params.length}`);
    }

    const result = await query(
      `
      SELECT
        lr.id AS "requestId",
        COALESCE(lr.employee_gas_id, e.gas_id) AS "employeeGasId",
        COALESCE(lr.employee_name, e.full_name) AS "employeeName",
        COALESCE(e.project_name, '') AS "projectName",
        COALESCE(e.package_name, '') AS "packageName",
        COALESCE(e.job_title, '') AS "position",
        lr.type,
        lr.status,
        lr.start_date AS "startDate",
        lr.end_date AS "endDate",
        lr.created_at AS "requestDate",
        lr.reviewer_name AS "reviewerName",
        lr.reviewed_at AS "reviewedAt",
        lf.id AS "formId",
        lf.generated_at AS "generatedAt"
      FROM leave_requests lr
      LEFT JOIN employees e ON e.id = lr.employee_id
      LEFT JOIN leave_forms lf ON lf.request_id = lr.id
      WHERE ${where.join(" AND ")}
      ORDER BY lr.reviewed_at DESC NULLS LAST, lr.created_at DESC
      LIMIT 500
      `,
      params
    );

    const forms = result.rows.map((row) => ({
      ...row,
      leaveTypeLabel: labelLeaveType(row.type),
      daysCount: calcDays(row.startDate, row.endDate),
    }));

    const stats = {
      total: forms.length,
      annual: forms.filter((item) => item.type === "annual_leave").length,
      emergency: forms.filter((item) => item.type === "emergency_leave").length,
      sick: forms.filter((item) => item.type === "sick_leave").length,
    };

    return res.json({ forms, stats });
  } catch (error) {
    console.error("Leave forms list error:", error);
    return res.status(500).json({
      message: error.message || "Failed to load leave forms",
    });
  }
});

router.get("/:requestId", async (req, res) => {
  try {
    if (!canViewLeaveForms(req.user)) {
      return res.status(403).json({
        message: "You do not have permission to view leave forms",
      });
    }

    const form = await getLeaveFormByRequestId(req.params.requestId);

    if (!form) {
      return res.status(404).json({
        message: "Approved leave form not found",
      });
    }

    await upsertLeaveFormRecord({
      requestId: form.requestId,
      employeeId: form.employeeId,
      generatedBy: req.user?.id || null,
    });

    const refreshed = await getLeaveFormByRequestId(req.params.requestId);

    return res.json({
      form: refreshed,
      html: buildLeaveFormHtml(refreshed),
    });
  } catch (error) {
    console.error("Leave form preview error:", error);
    return res.status(500).json({
      message: error.message || "Failed to load leave form",
    });
  }
});

router.get("/:requestId/pdf", async (req, res) => {
  let browser;

  try {
    if (!canViewLeaveForms(req.user)) {
      return res.status(403).json({
        message: "You do not have permission to download leave forms",
      });
    }

    const form = await getLeaveFormByRequestId(req.params.requestId);

    if (!form) {
      return res.status(404).json({
        message: "Approved leave form not found",
      });
    }

    await upsertLeaveFormRecord({
      requestId: form.requestId,
      employeeId: form.employeeId,
      generatedBy: req.user?.id || null,
    });

    const html = buildLeaveFormHtml({
      ...form,
      generatedAt: new Date(),
    });

    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });

    const page = await browser.newPage();

    await page.setContent(html, {
      waitUntil: "networkidle0",
      timeout: 120000,
    });

    const pdfBuffer = await page.pdf({
      format: "A4",
      landscape: false,
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: "8mm",
        right: "8mm",
        bottom: "8mm",
        left: "8mm",
      },
    });

    const gasId = String(form.employeeGasId || "employee").replace(/[^a-zA-Z0-9_-]+/g, "_");
    const fileName = `Leave_Request_Form_${gasId}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Content-Length", pdfBuffer.length);

    return res.end(pdfBuffer);
  } catch (error) {
    console.error("Leave form PDF error:", error);
    return res.status(500).json({
      message: error.message || "Failed to generate leave form PDF",
    });
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
});

export default router;
