import express from "express";
import puppeteer from "puppeteer";
import { query } from "../data/index.js";
import { requireAuth } from "../middleware_auth.js";

const router = express.Router();
router.use(requireAuth);

const DEFAULT_TEMPLATE = {
  fontFamily: "Times New Roman",
  fontSize: 11,
  titleSize: 21,
  borderColor: "#000000",
  headerBg: "#f3f3f3",
  textColor: "#000000",
  titleColor: "#000000",
  isBold: true,
  zoom: 100,
  customNote: "",
};

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

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function safeColor(value, fallback) {
  const color = String(value || "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : fallback;
}

function safeNumber(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

function normalizeTemplate(template = {}) {
  return {
    fontFamily: String(template.fontFamily || DEFAULT_TEMPLATE.fontFamily),
    fontSize: safeNumber(template.fontSize, DEFAULT_TEMPLATE.fontSize, 8, 18),
    titleSize: safeNumber(template.titleSize, DEFAULT_TEMPLATE.titleSize, 14, 34),
    borderColor: safeColor(template.borderColor, DEFAULT_TEMPLATE.borderColor),
    headerBg: safeColor(template.headerBg, DEFAULT_TEMPLATE.headerBg),
    textColor: safeColor(template.textColor, DEFAULT_TEMPLATE.textColor),
    titleColor: safeColor(template.titleColor, DEFAULT_TEMPLATE.titleColor),
    isBold: Boolean(template.isBold),
    zoom: safeNumber(template.zoom, DEFAULT_TEMPLATE.zoom, 70, 120),
    customNote: String(template.customNote || ""),
  };
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

function getGasLogoDataUri() {
  return "https://res.cloudinary.com/dk2s2mw2d/image/upload/v1780373677/%D8%AC%D8%A7%D8%B2_jdvaaj.jpg";
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

async function ensureLeaveFormTemplatesTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS leave_form_templates (
      id SERIAL PRIMARY KEY,
      template_key VARCHAR(80) NOT NULL UNIQUE,
      template_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_by INTEGER NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
}

async function getLeaveFormTemplate() {
  await ensureLeaveFormTemplatesTable();

  const result = await query(
    `
    SELECT template_json AS "templateJson"
    FROM leave_form_templates
    WHERE template_key = 'default'
    LIMIT 1
    `
  );

  return normalizeTemplate(result.rows[0]?.templateJson || DEFAULT_TEMPLATE);
}

async function saveLeaveFormTemplate(template, userId) {
  await ensureLeaveFormTemplatesTable();

  const cleanTemplate = normalizeTemplate(template);
  const safeUserId = toNullableInteger(userId);

  await query(
    `
    INSERT INTO leave_form_templates (
      template_key,
      template_json,
      updated_by,
      updated_at
    )
    VALUES (
      'default',
      $1::jsonb,
      $2::integer,
      NOW()
    )
    ON CONFLICT (template_key)
    DO UPDATE SET
      template_json = EXCLUDED.template_json,
      updated_by = EXCLUDED.updated_by,
      updated_at = NOW()
    `,
    [JSON.stringify(cleanTemplate), safeUserId]
  );

  return cleanTemplate;
}

async function upsertLeaveFormRecord({ requestId, employeeId, generatedBy }) {
  await ensureLeaveFormsTable();

  const safeRequestId = toNullableInteger(requestId);
  const safeEmployeeId = toNullableInteger(employeeId);
  const safeGeneratedBy = toNullableInteger(generatedBy);

  if (!safeRequestId) throw new Error("Invalid leave request id");

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

function buildLeaveFormHtml(form, template = DEFAULT_TEMPLATE) {
  const design = normalizeTemplate(template);
  const type = String(form?.type || "").toLowerCase();
  const balance = getBalanceInfo(form);
  const logoDataUri = getGasLogoDataUri();

  const isAnnual = type === "annual_leave";
  const isEmergency = type === "emergency_leave";
  const isSick = type === "sick_leave";
  const isUnpaid = type === "unpaid_leave";
  const isApproved = String(form?.status || "").toLowerCase() === "approved";
  const checkStr = (condition) => (condition ? "☒" : "☐");

  const bodyWeight = design.isBold ? 700 : 400;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Leave Request Form</title>
  <style>
    @page { size: A4 portrait; margin: 8mm 8mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body {
      margin: 0;
      background: #ffffff;
      color: ${design.textColor};
      font-family: "${escapeHtml(design.fontFamily)}", Arial, sans-serif;
      font-size: ${design.fontSize}px;
      line-height: 1.2;
      font-weight: ${bodyWeight};
    }
    .page { width: 100%; max-width: 194mm; margin: 0 auto; position: relative; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: 0px; }
    td {
      border: 1px solid ${design.borderColor};
      padding: 5px 6px;
      vertical-align: middle;
      font-size: ${Math.max(design.fontSize - 0.5, 8)}px;
      color: ${design.textColor};
    }
    .center { text-align: center; }
    .bold { font-weight: 700; }
    .header-table td { padding: 0; }
    .logo-cell { width: 25%; text-align: center; vertical-align: middle; padding: 5px; }
    .logo-container { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; }
    .gas-logo-img { width: 100%; max-width: 160px; height: auto; max-height: 65px; object-fit: contain; }
    .title-cell { width: 50%; text-align: center; }
    .qms-title {
      font-size: ${Math.max(design.fontSize, 9)}px;
      font-weight: 700;
      padding: 5px 0;
      border-bottom: 1px solid ${design.borderColor};
      color: ${design.titleColor};
    }
    .form-title {
      font-size: ${design.titleSize}px;
      font-weight: 800;
      padding: 4px 0;
      border-bottom: 1px solid ${design.borderColor};
      letter-spacing: 0.5px;
      color: ${design.titleColor};
    }
    .form-code { font-size: ${Math.max(design.fontSize, 9)}px; font-weight: 700; padding: 4px 0; }
    .meta-label { width: 13%; font-weight: 700; font-size: ${Math.max(design.fontSize - 1, 8)}px; padding: 4px 6px; background: ${design.headerBg}; }
    .meta-value { width: 12%; text-align: center; font-size: ${Math.max(design.fontSize - 1, 8)}px; padding: 4px 6px; }
    .notice-top {
      text-align: center;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 7.5px;
      font-weight: 700;
      padding: 5px 0;
      color: ${design.textColor};
    }
    .field-label {
      font-weight: 700;
      text-transform: uppercase;
      background: ${design.headerBg};
      font-size: ${Math.max(design.fontSize - 1, 8)}px;
    }
    .field-value { font-weight: 700; }
    .spacer { height: 12px; }
    .chk-box { font-family: "Times New Roman", serif; font-size: 13px; margin-right: 4px; vertical-align: middle; font-weight: normal; }
    .option-group { display: flex; justify-content: flex-start; gap: 45px; }
    .section-title {
      text-align: center;
      font-weight: 700;
      text-transform: uppercase;
      background: ${design.headerBg};
      font-size: ${Math.max(design.fontSize, 9)}px;
      padding: 4px;
    }
    .section-title em { font-size: 9px; font-style: italic; font-weight: normal; }
    .review-cell { vertical-align: top; padding: 8px 10px; }
    .review-item { display: block; margin-bottom: 5px; font-weight: 700; }
    .comments-box { height: 52px; vertical-align: top; font-size: ${Math.max(design.fontSize - 1, 8)}px; padding: 6px; }
    .signature-title { background: ${design.headerBg}; font-weight: 700; text-transform: uppercase; padding: 4px 6px; }
    .signature-name { height: 60px; text-align: center; vertical-align: middle; font-weight: 700; }
    .custom-note {
      margin-top: 7px;
      padding-top: 5px;
      border-top: 1px dashed ${design.borderColor};
      white-space: pre-wrap;
      font-weight: 700;
    }
    .footer {
      position: absolute;
      left: 0;
      right: 0;
      bottom: -6mm;
      display: flex;
      justify-content: space-between;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 7.5px;
      font-weight: 700;
      border-top: 1px solid ${design.borderColor};
      padding-top: 4px;
    }
    .no-border { border: none !important; }
  </style>
</head>
<body>
  <div class="page">
    <table class="header-table">
      <tr>
        <td rowspan="3" class="logo-cell">
          <div class="logo-container">
            <img class="gas-logo-img" src="${logoDataUri}" alt="GAS Logo" />
          </div>
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
      <tr>
        <td class="field-label" style="width: 20%;">EMPLOYEE NO.</td>
        <td class="field-value center" style="width: 30%;">${escapeHtml(form?.employeeGasId)}</td>
        <td class="field-label" style="width: 20%;">DIVISION</td>
        <td class="field-value" style="width: 30%;">${escapeHtml(form?.projectName || "LEAVE")}</td>
      </tr>
      <tr>
        <td class="field-label">EMPLOYEE NAME</td>
        <td class="field-value">${escapeHtml(form?.employeeName)}</td>
        <td class="field-label">POSITION</td>
        <td class="field-value">${escapeHtml(form?.position || "")}</td>
      </tr>
    </table>

    <div class="spacer"></div>

    <table>
      <tr>
        <td class="field-label" style="width: 16.6%;">REQUEST DATE</td>
        <td class="center" style="width: 16.6%;">${formatDate(form?.requestDate)}</td>
        <td class="field-label" style="width: 20%;">LEAVE START DATE</td>
        <td class="center" style="width: 16.6%;">${formatDate(form?.startDate)}</td>
        <td class="field-label" style="width: 18%;">LEAVE END DATE</td>
        <td class="center" style="width: 13.6%;">${formatDate(form?.endDate)}</td>
      </tr>
      <tr>
        <td class="field-label" style="height: 55px;">LEAVE TYPE:</td>
        <td colspan="5" style="padding: 6px 12px;">
          <div class="option-group">
            <span><span class="chk-box">${checkStr(isAnnual)}</span> ANNUAL</span>
            <span><span class="chk-box">${checkStr(isUnpaid)}</span> UNPAID</span>
            <span><span class="chk-box">${checkStr(isEmergency)}</span> EMERGENCY</span>
          </div>
          <div style="margin-top: 6px;">
            <span><span class="chk-box">${checkStr(isSick)}</span> OTHER:</span>
            <span style="border-bottom: 1px solid ${design.borderColor}; padding-right: 120px; font-weight: bold; margin-left: 4px;">
              ${isSick ? "SICK LEAVE" : ""}
            </span>
          </div>
        </td>
      </tr>
    </table>

    <div class="spacer"></div>

    <table>
      <tr>
        <td class="section-title" colspan="2" style="width: 50%;">
          LEAVE DETAILS <em>(TO BE FILLED BY REQUESTOR)</em>
        </td>
        <td class="section-title" colspan="2" style="width: 50%;">
          REVIEW AND COMMENTS <em>(TO BE FILLED BY HRPM)</em>
        </td>
      </tr>
      <tr>
        <td class="field-label" style="width: 33%;">TOTAL VACATION BALANCE</td>
        <td class="center" style="width: 17%;">${escapeHtml(balance.total)}</td>
        <td class="review-cell" colspan="2" rowspan="5">
          <span class="review-item"><span class="chk-box">${checkStr(isApproved && !isUnpaid && !isSick && !isEmergency)}</span> LEAVE APPROVED</span>
          <span class="review-item"><span class="chk-box">${checkStr(!isApproved)}</span> LEAVE NOT APPROVED</span>
          <span class="review-item"><span class="chk-box">☐</span> LEAVE RE-SCHEDULED</span>
          <span class="review-item"><span class="chk-box">☐</span> LEAVE APPROVED WITH CONDITION</span>
          <span class="review-item"><span class="chk-box">${checkStr(isApproved && isUnpaid)}</span> LEAVE APPROVED (UNPAID)</span>
        </td>
      </tr>
      <tr><td class="field-label">NUMBER OF DAYS APPLIED FOR</td><td class="center">${escapeHtml(balance.days)}</td></tr>
      <tr><td class="field-label">TOTAL LEAVE DAYS</td><td class="center">${escapeHtml(balance.days)}</td></tr>
      <tr><td class="field-label">BALANCE OF UNUSED LEAVE</td><td class="center">${escapeHtml(balance.remaining)}</td></tr>
      <tr>
        <td class="field-label">VACATION SALARY</td>
        <td class="center"><span style="margin-right: 8px;"><span class="chk-box">☐</span> YES</span><span><span class="chk-box">☐</span> NO</span></td>
      </tr>
      <tr>
        <td class="field-label">EXIT RE-ENTRY</td>
        <td class="center"><span style="margin-right: 8px;"><span class="chk-box">☐</span> YES</span><span><span class="chk-box">☐</span> NO</span></td>
        <td colspan="2" rowspan="2" class="comments-box">
          <div class="bold" style="margin-bottom: 2px;">Comments/Justification:</div>
          <div style="font-weight: normal; white-space: pre-wrap;">${escapeHtml(form?.note || "")}</div>
          ${
            design.customNote
              ? `<div class="custom-note">${escapeHtml(design.customNote)}</div>`
              : ""
          }
        </td>
      </tr>
      <tr>
        <td class="field-label">TICKET</td>
        <td class="center"><span style="margin-right: 8px;"><span class="chk-box">☐</span> YES</span><span><span class="chk-box">☐</span> NO</span></td>
      </tr>
    </table>

    <div class="spacer"></div>

    <table>
      <tr>
        <td class="field-label" style="width: 25%;">TRAVEL DETAILS</td>
        <td class="field-label center" style="width: 25%;">DATE</td>
        <td class="field-label center" style="width: 25%;">FROM</td>
        <td class="field-label center" style="width: 25%;">TO</td>
      </tr>
      <tr><td class="field-label">DEPARTURE</td><td></td><td></td><td></td></tr>
      <tr><td class="field-label">RETURN</td><td></td><td></td><td></td></tr>
      <tr><td class="field-label">REJOINING</td><td></td><td></td><td></td></tr>
    </table>

    <div class="spacer"></div>

    <table>
      <tr><td class="section-title" colspan="4">THE "HOME CONTACT & ADDRESS" FOR THE DURATION OF THE LEAVE WILL BE</td></tr>
      <tr><td class="field-label" style="width: 20%;">TELEPHONE NO.</td><td style="width: 30%;"></td><td class="field-label" style="width: 20%;">MOBILE NO.</td><td style="width: 30%;"></td></tr>
      <tr><td class="field-label">ADDRESS</td><td colspan="3"></td></tr>
    </table>

    <div class="spacer"></div>

    <table>
      <tr><td class="section-title" colspan="4">THE "EMERGENCY CONTACT ADDRESS" FOR THE DURATION OF THE LEAVE WILL BE - FIRST-DEGREE RELATIVE</td></tr>
      <tr><td class="field-label" style="width: 20%;">TELEPHONE NO.</td><td style="width: 30%;"></td><td class="field-label" style="width: 20%;">MOBILE NO.</td><td style="width: 30%;"></td></tr>
      <tr><td class="field-label">ADDRESS</td><td colspan="3"></td></tr>
    </table>

    <div class="spacer"></div>

    <table>
      <tr><td class="signature-title" colspan="3">INITIATOR AND APPROVERS</td></tr>
      <tr>
        <td class="field-label center" style="width: 33.3%;">REQUESTED BY</td>
        <td class="field-label center" style="width: 33.3%;">ACKNOWLEDGE BY</td>
        <td class="field-label center" style="width: 33.3%;">APPROVED BY</td>
      </tr>
      <tr>
        <td class="signature-name">${escapeHtml(form?.requestedByName || form?.employeeName)}</td>
        <td class="signature-name"></td>
        <td class="signature-name">${escapeHtml(form?.reviewerName || "")}</td>
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

router.get("/template", async (req, res) => {
  try {
    if (!canViewLeaveForms(req.user)) {
      return res.status(403).json({ message: "You do not have permission to view leave form template" });
    }

    const template = await getLeaveFormTemplate();
    return res.json({ template });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to load template" });
  }
});

router.put("/template", async (req, res) => {
  try {
    if (!canViewLeaveForms(req.user)) {
      return res.status(403).json({ message: "You do not have permission to update leave form template" });
    }

    const template = await saveLeaveFormTemplate(req.body?.template || {}, req.user?.id || null);
    return res.json({ message: "Template saved successfully", template });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to save template" });
  }
});

router.get("/", async (req, res) => {
  try {
    if (!canViewLeaveForms(req.user)) {
      return res.status(403).json({ message: "You do not have permission to view leave forms" });
    }

    await ensureLeaveFormsTable();

    const { search = "", project = "", packageName = "", type = "", month = "", year = "" } = req.query;
    const params = [];
    const where = ["lr.type IN ('annual_leave', 'emergency_leave', 'sick_leave', 'unpaid_leave')"];

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
        lr.employee_id AS "employeeId",
        COALESCE(lr.employee_gas_id, e.gas_id) AS "employeeGasId",
        COALESCE(lr.employee_name, e.full_name) AS "employeeName",
        COALESCE(e.project_name, '') AS "projectName",
        COALESCE(e.package_name, '') AS "packageName",
        COALESCE(e.job_title, '') AS "position",
        lr.type,
        lr.status,
        lr.note,
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
      ORDER BY lr.created_at DESC
      LIMIT 500
      `,
      params
    );

    const forms = result.rows.map((row) => ({
      ...row,
      leaveTypeLabel: labelLeaveType(row.type),
      daysCount: calcDays(row.startDate, row.endDate),
    }));

    const stats = forms.reduce(
      (acc, item) => {
        acc.total += 1;
        if (item.type === "annual_leave") acc.annual += 1;
        if (item.type === "emergency_leave") acc.emergency += 1;
        if (item.type === "sick_leave") acc.sick += 1;
        return acc;
      },
      { total: 0, annual: 0, emergency: 0, sick: 0 }
    );

    return res.json({ forms, stats });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to load leave forms" });
  }
});

router.post("/", async (req, res) => {
  try {
    if (!canViewLeaveForms(req.user)) {
      return res.status(403).json({ message: "Unauthorized to add leave forms" });
    }

    const {
      employeeGasId,
      employeeName,
      type,
      startDate,
      endDate,
      status,
      note,
    } = req.body;

    const reqResult = await query(
      `
      INSERT INTO leave_requests (
        employee_gas_id,
        employee_name,
        type,
        start_date,
        end_date,
        status,
        note,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING id
      `,
      [
        employeeGasId || "",
        employeeName || "",
        type || "annual_leave",
        startDate || null,
        endDate || null,
        status || "approved",
        note || "",
      ]
    );

    const newRequestId = reqResult.rows[0].id;

    await upsertLeaveFormRecord({
      requestId: newRequestId,
      employeeId: null,
      generatedBy: req.user?.id || null,
    });

    return res.json({ message: "Leave form created successfully", requestId: newRequestId });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Create failed" });
  }
});

router.put("/:requestId", async (req, res) => {
  try {
    if (!canViewLeaveForms(req.user)) {
      return res.status(403).json({ message: "Unauthorized to edit leave forms" });
    }

    const safeId = toNullableInteger(req.params.requestId);
    if (!safeId) return res.status(400).json({ message: "Invalid request id" });

    const { employeeGasId, employeeName, type, startDate, endDate, status, note } = req.body;

    await query(
      `
      UPDATE leave_requests
      SET
        employee_gas_id = $1,
        employee_name = $2,
        type = $3,
        start_date = $4,
        end_date = $5,
        status = $6,
        note = $7,
        updated_at = NOW()
      WHERE id = $8::integer
      `,
      [
        employeeGasId || "",
        employeeName || "",
        type || "annual_leave",
        startDate || null,
        endDate || null,
        status || "approved",
        note || "",
        safeId,
      ]
    );

    return res.json({ message: "Leave form updated successfully" });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Update failed" });
  }
});

router.delete("/:requestId", async (req, res) => {
  try {
    if (!canViewLeaveForms(req.user)) {
      return res.status(403).json({ message: "Unauthorized to delete leave forms" });
    }

    const safeId = toNullableInteger(req.params.requestId);
    if (!safeId) return res.status(400).json({ message: "Invalid request id" });

    await query(`DELETE FROM leave_forms WHERE request_id = $1::integer`, [safeId]);
    await query(`DELETE FROM leave_requests WHERE id = $1::integer`, [safeId]);

    return res.json({ message: "Leave form deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Delete failed" });
  }
});

router.get("/:requestId", async (req, res) => {
  try {
    if (!canViewLeaveForms(req.user)) {
      return res.status(403).json({ message: "You do not have permission to view leave forms" });
    }

    const form = await getLeaveFormByRequestId(req.params.requestId);
    if (!form) return res.status(404).json({ message: "Leave form not found" });

    await upsertLeaveFormRecord({
      requestId: form.requestId,
      employeeId: form.employeeId,
      generatedBy: req.user?.id || null,
    });

    const refreshed = await getLeaveFormByRequestId(req.params.requestId);
    const template = await getLeaveFormTemplate();

    return res.json({
      form: refreshed,
      template,
      html: buildLeaveFormHtml(refreshed, template),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to load leave form" });
  }
});

router.get("/:requestId/pdf", async (req, res) => {
  let browser;

  try {
    if (!canViewLeaveForms(req.user)) {
      return res.status(403).json({ message: "You do not have permission to download leave forms" });
    }

    const form = await getLeaveFormByRequestId(req.params.requestId);
    if (!form) return res.status(404).json({ message: "Leave form not found" });

    const template = await getLeaveFormTemplate();
    const html = buildLeaveFormHtml({ ...form, generatedAt: new Date() }, template);

    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 120000 });

    const pdfBuffer = await page.pdf({
      format: "A4",
      landscape: false,
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "8mm", right: "8mm", bottom: "8mm", left: "8mm" },
    });

    const gasId = String(form.employeeGasId || "employee").replace(/[^a-zA-Z0-9_-]+/g, "_");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="Leave_Request_Form_${gasId}.pdf"`);

    return res.end(pdfBuffer);
  } catch (error) {
    return res.status(500).json({ message: error.message || "PDF generation failed" });
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
});

export default router;
