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

function getGasLogoDataUri() {
  try {
    const possiblePaths = [
      path.join(__dirname, "..", "assets", "GAS-Logo.jpg"),
      path.join(process.cwd(), "src", "assets", "GAS-Logo.jpg"),
      path.join(process.cwd(), "backend", "src", "assets", "GAS-Logo.jpg"),
      path.join(process.cwd(), "v29", "backend", "src", "assets", "GAS-Logo.jpg"),
    ];

    const logoPath = possiblePaths.find((item) => fs.existsSync(item));

    if (!logoPath) {
      console.error("GAS logo not found. Tried:", possiblePaths);
      return "";
    }

    const imageBuffer = fs.readFileSync(logoPath);

    let mimeType = "image/jpeg";

    if (imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50) {
      mimeType = "image/png";
    } else if (imageBuffer[0] === 0xff && imageBuffer[1] === 0xd8) {
      mimeType = "image/jpeg";
    } else if (imageBuffer.toString("utf8", 0, 120).includes("<svg")) {
      mimeType = "image/svg+xml";
    } else if (imageBuffer.toString("utf8", 0, 20).includes("WEBP")) {
      mimeType = "image/webp";
    }

    return `data:${mimeType};base64,${imageBuffer.toString("base64")}`;
  } catch (error) {
    console.error("GAS logo error:", error);
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
    VALUES ($1::integer, $2::integer, $3::integer, NOW(), NOW())
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

  if (!safeRequestId) return null;

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
      lf.id AS "formId",
      lf.generated_at AS "generatedAt"
    FROM leave_requests lr
    LEFT JOIN employees e ON e.id = lr.employee_id
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

function buildLeaveFormHtml(form) {
  const logoDataUri = getGasLogoDataUri();

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Leave Request Form</title>

  <style>
    @page {
      size: A4 portrait;
      margin: 0;
    }

    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    html,
    body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #000000;
      font-family: "Times New Roman", Times, serif;
    }

    body {
      font-size: 14px;
      line-height: 1.05;
    }

    .page {
      width: 210mm;
      height: 297mm;
      position: relative;
      overflow: hidden;
      background: #ffffff;
    }

    .main {
      width: 176mm;
      margin-left: auto;
      margin-right: auto;
      padding-top: 12mm;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }

    td {
      border: 1px solid #000;
      padding: 0 2mm;
      vertical-align: middle;
      color: #000;
    }

    .header td {
      height: 7.8mm;
    }

    .logo-cell {
      width: 35mm;
      height: 31mm !important;
      text-align: center;
      padding: 0;
      vertical-align: middle;
    }

    .gas-logo-img {
      width: 30mm;
      height: auto;
      max-height: 26mm;
      object-fit: contain;
      display: block;
      margin: 0 auto;
    }

    .gas-fallback {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 30px;
      font-weight: 900;
      color: #006b78;
    }

    .title-cell {
      width: 86mm;
      text-align: center;
      padding: 0;
    }

    .qms-title {
      height: 8mm;
      font-size: 13px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-bottom: 1px solid #000;
    }

    .form-title {
      height: 13mm;
      font-size: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-bottom: 1px solid #000;
      letter-spacing: 0.2px;
    }

    .form-code {
      height: 8mm;
      font-size: 13px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .meta-label {
      width: 25mm;
      font-size: 13px;
      white-space: nowrap;
    }

    .meta-value {
      width: 24mm;
      font-size: 15px;
      white-space: nowrap;
    }

    .notice {
      text-align: center;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 6.6px;
      font-weight: 700;
      margin: 3.6mm 0 2.4mm;
      white-space: nowrap;
    }

    .label {
      background: #f3f3f3;
      font-weight: 700;
      text-transform: uppercase;
    }

    .value {
      font-weight: 700;
      text-transform: uppercase;
    }

    .center {
      text-align: center;
    }

    .employee td {
      height: 7.3mm;
      font-size: 14px;
    }

    .date-table {
      margin-top: 5mm;
    }

    .date-table td {
      height: 7.4mm;
      font-size: 13px;
    }

    .leave-type-row td {
      height: 20mm;
      font-size: 14px;
    }

    .checkbox {
      display: inline-block;
      width: 4.3mm;
      height: 4.3mm;
      border: 1.2px solid #000;
      margin-right: 2.5mm;
      vertical-align: -0.9mm;
      line-height: 3.8mm;
      text-align: center;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 10px;
      font-weight: 700;
    }

    .option {
      display: inline-block;
      min-width: 35mm;
      white-space: nowrap;
    }

    .two-boxes {
      display: grid;
      grid-template-columns: 81mm 86mm;
      column-gap: 9mm;
      margin-top: 6mm;
      align-items: start;
    }

    .section-title {
      background: #f3f3f3;
      text-align: center;
      font-size: 16px;
      height: 7.4mm;
      white-space: nowrap;
    }

    .section-title em {
      font-size: 11px;
      font-weight: 700;
    }

    .leave-details td {
      height: 7.15mm;
      font-size: 14px;
    }

    .leave-details .left-col {
      width: 63mm;
    }

    .review td {
      font-size: 14px;
    }

    .review-list {
      height: 40mm;
      padding: 4mm 4mm;
      vertical-align: top;
    }

    .review-item {
      display: block;
      margin-bottom: 3mm;
      white-space: nowrap;
    }

    .comments {
      height: 18mm;
      vertical-align: top;
      padding-top: 2mm;
    }

    .travel {
      margin-top: 5mm;
    }

    .travel td {
      height: 6.6mm;
      font-size: 14px;
    }

    .travel .head td {
      background: #f3f3f3;
      font-weight: 700;
      text-align: center;
    }

    .contact {
      margin-top: 6mm;
    }

    .contact.emergency {
      margin-top: 7mm;
    }

    .contact td {
      height: 6.3mm;
      font-size: 14px;
    }

    .contact-title {
      background: #f3f3f3;
      height: 6.8mm;
      font-size: 14px;
      text-transform: uppercase;
    }

    .sign {
      margin-top: 7mm;
    }

    .sign td {
      font-size: 14px;
    }

    .sign-title {
      height: 6.7mm;
      background: #f3f3f3;
      text-transform: uppercase;
    }

    .sign-head td {
      height: 6.9mm;
      text-align: center;
      font-weight: 700;
    }

    .sign-name td {
      height: 24mm;
      text-align: center;
      font-weight: 700;
      text-transform: uppercase;
    }

    .sign-bottom td {
      height: 7mm;
    }

    .footer {
      position: absolute;
      left: 17mm;
      right: 17mm;
      bottom: 12mm;
      width: 176mm;
      display: flex;
      justify-content: space-between;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 10px;
      color: #000;
    }
  </style>
</head>

<body>
  <div class="page">
    <div class="main">

      <table class="header">
        <tr>
          <td rowspan="3" class="logo-cell">
            ${
              logoDataUri
                ? `<img class="gas-logo-img" src="${logoDataUri}" />`
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
          <td style="border:none;"></td>
          <td style="border:none;"></td>
          <td class="meta-label">Page No.</td>
          <td class="meta-value">1 of 1</td>
        </tr>
      </table>

      <div class="notice">
        ANY MODIFICATION TO THIS DOCUMENT SHALL BE THROUGH CQMC ONLY. THINK DIGITAL. WORK SMART. SAVE PLANET.
      </div>

      <table class="employee">
        <tr>
          <td class="label" style="width:35mm;">EMPLOYEE NO.</td>
          <td class="value center" style="width:67mm;">${escapeHtml(form?.employeeGasId)}</td>
          <td class="label" style="width:40mm;">DIVISION</td>
          <td style="width:34mm;">${escapeHtml(form?.projectName || "LEAVE")}</td>
        </tr>
        <tr>
          <td class="label">EMPLOYEE NAME</td>
          <td class="value center">${escapeHtml(form?.employeeName)}</td>
          <td class="label">POSITION</td>
          <td class="value">${escapeHtml(form?.position || "")}</td>
        </tr>
      </table>

      <table class="date-table">
        <tr>
          <td class="label center" style="width:28mm;">REQUEST DATE</td>
          <td style="width:29mm;">${formatDate(form?.requestDate)}</td>
          <td class="label center" style="width:39mm;">LEAVE START DATE</td>
          <td style="width:32mm;">${formatDate(form?.startDate)}</td>
          <td class="label center" style="width:39mm;">LEAVE END DATE</td>
          <td style="width:33mm;">${formatDate(form?.endDate)}</td>
        </tr>

        <tr class="leave-type-row">
          <td class="label">LEAVE TYPE:</td>
          <td colspan="5">
            <div style="margin-bottom: 5mm;">
              <span class="option"><span class="checkbox"></span>ANNUAL</span>
              <span class="option"><span class="checkbox"></span>UNPAID</span>
              <span class="option"><span class="checkbox"></span>EMERGENCY</span>
            </div>

            <div>
              <span class="checkbox"></span>OTHER:
              <span style="display:inline-block;width:45mm;border-bottom:1px solid #000;margin-left:2mm;"></span>
            </div>
          </td>
        </tr>
      </table>

      <div class="two-boxes">
        <table class="leave-details">
          <tr>
            <td colspan="2" class="section-title">
              LEAVE DETAILS <em>(TO BE FILLED BY REQUESTOR)</em>
            </td>
          </tr>

          <tr>
            <td class="left-col">TOTAL VACATION BALANCE</td>
            <td></td>
          </tr>

          <tr>
            <td>NUMBER OF DAYS APPLIED FOR</td>
            <td></td>
          </tr>

          <tr>
            <td>TOTAL LEAVE DAYS</td>
            <td></td>
          </tr>

          <tr>
            <td>BALANCE OF UNUSED LEAVE</td>
            <td></td>
          </tr>

          <tr>
            <td colspan="2">
              VACATION SALARY
              <span style="margin-left:7mm;"><span class="checkbox"></span>YES</span>
              <span style="margin-left:13mm;"><span class="checkbox"></span>NO</span>
            </td>
          </tr>

          <tr>
            <td colspan="2">
              EXIT RE-ENTRY
              <span style="margin-left:10mm;"><span class="checkbox"></span>YES</span>
              <span style="margin-left:13mm;"><span class="checkbox"></span>NO</span>
            </td>
          </tr>

          <tr>
            <td colspan="2">
              TICKET
              <span style="margin-left:26mm;"><span class="checkbox"></span>YES</span>
              <span style="margin-left:13mm;"><span class="checkbox"></span>NO</span>
            </td>
          </tr>
        </table>

        <table class="review">
          <tr>
            <td class="section-title">
              REVIEW AND COMMENTS <em>(TO BE FILLED BY HRPM)</em>
            </td>
          </tr>

          <tr>
            <td class="review-list">
              <span class="review-item"><span class="checkbox"></span> LEAVE APPROVED</span>
              <span class="review-item"><span class="checkbox"></span> LEAVE NOT APPROVED</span>
              <span class="review-item"><span class="checkbox"></span> LEAVE RE-SCHEDULED</span>
              <span class="review-item"><span class="checkbox"></span> LEAVE APPROVED WITH CONDITION</span>
              <span class="review-item"><span class="checkbox"></span> LEAVE APPROVED (UNPAID)</span>
            </td>
          </tr>

          <tr>
            <td class="comments">Comments / Justification</td>
          </tr>
        </table>
      </div>

      <table class="travel">
        <tr class="head">
          <td style="width:40mm;">TRAVEL DETAILS</td>
          <td style="width:57mm;">DATE</td>
          <td style="width:57mm;">FROM</td>
          <td style="width:46mm;">TO</td>
        </tr>

        <tr>
          <td>DEPARTURE</td>
          <td></td>
          <td></td>
          <td></td>
        </tr>

        <tr>
          <td>RETURN</td>
          <td></td>
          <td></td>
          <td></td>
        </tr>

        <tr>
          <td>REJOINING</td>
          <td></td>
          <td></td>
          <td>
            <span style="margin-left:4mm;" class="checkbox"></span>
            <span style="margin-left:12mm;" class="checkbox"></span>
          </td>
        </tr>
      </table>

      <table class="contact">
        <tr>
          <td colspan="4" class="contact-title">
            THE “HOME CONTACT &amp; ADDRESS” FOR THE DURATION OF THE LEAVE WILL BE
          </td>
        </tr>

        <tr>
          <td class="label" style="width:40mm;">TELEPHONE NO.</td>
          <td style="width:58mm;"></td>
          <td class="label" style="width:34mm;">MOBILE NO.</td>
          <td style="width:68mm;"></td>
        </tr>

        <tr>
          <td class="label">ADDRESS</td>
          <td colspan="3"></td>
        </tr>
      </table>

      <table class="contact emergency">
        <tr>
          <td colspan="4" class="contact-title">
            THE “EMERGENCY CONTACT ADDRESS” FOR THE DURATION OF THE LEAVE WILL BE – FIRST-DEGREE RELATIVE
          </td>
        </tr>

        <tr>
          <td class="label" style="width:40mm;">TELEPHONE NO.</td>
          <td style="width:58mm;"></td>
          <td class="label" style="width:34mm;">MOBILE NO.</td>
          <td style="width:68mm;"></td>
        </tr>

        <tr>
          <td class="label">ADDRESS</td>
          <td colspan="3"></td>
        </tr>
      </table>

      <table class="sign">
        <tr>
          <td colspan="3" class="sign-title">INITIATOR AND APPROVERS</td>
        </tr>

        <tr class="sign-head">
          <td>REQUESTED BY</td>
          <td>ACKNOWLEDGE BY</td>
          <td>APPROVED BY</td>
        </tr>

        <tr class="sign-name">
          <td>${escapeHtml(form?.requestedByName || form?.employeeName)}</td>
          <td></td>
          <td></td>
        </tr>

        <tr class="sign-bottom">
          <td></td>
          <td></td>
          <td></td>
        </tr>
      </table>

    </div>

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

    await page.setViewport({
      width: 794,
      height: 1123,
      deviceScaleFactor: 1,
    });

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
        top: "0mm",
        right: "0mm",
        bottom: "0mm",
        left: "0mm",
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
