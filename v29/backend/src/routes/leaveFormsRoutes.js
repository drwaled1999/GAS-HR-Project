import express from "express";
import puppeteer from "puppeteer";
import { query } from "../data/index.js";
import { requireAuth } from "../middleware_auth.js";

const router = express.Router();
router.use(requireAuth);

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
  const requestNo = `LV-${new Date(form?.requestDate || Date.now()).getFullYear()}-${String(
    form?.requestId || ""
  )
    .slice(0, 8)
    .toUpperCase()}`;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Leave Request Form</title>
  <style>
    @page { size: A4 landscape; margin: 8mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #111827; margin: 0; background: #fff; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    td, th { border: 1px solid #111827; padding: 5px 6px; font-size: 10px; vertical-align: middle; }
    .center { text-align: center; }
    .bold { font-weight: 800; }
    .small { font-size: 8.5px; }
    .tiny { font-size: 7.5px; }
    .title { font-size: 15px; font-weight: 900; }
    .subtitle { font-size: 12px; font-weight: 900; }
    .header-left {
      height: 54px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 900;
      font-size: 18px;
    }
    .field-label { background: #f3f4f6; font-weight: 900; text-transform: uppercase; }
    .section { background: #e5e7eb; font-weight: 900; text-align: center; }
    .checkbox {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 1.5px solid #111827;
      text-align: center;
      line-height: 14px;
      font-weight: 900;
      margin: 0 5px 0 10px;
    }
    .signature-space { height: 54px; }
    .footer-note {
      margin-top: 6px;
      font-size: 8px;
      display: flex;
      justify-content: space-between;
    }
  </style>
</head>

<body>
  <table>
    <tr>
      <td rowspan="4" style="width:19%;"><div class="header-left">GAS</div></td>
      <td rowspan="4" class="center" style="width:45%;">
        <div class="small bold">QUALITY MANAGEMENT SYSTEM FORM</div>
        <div class="title">LEAVE REQUEST FORM</div>
        <div class="subtitle">GAS-QMS-F-006-01</div>
      </td>
      <td class="field-label" style="width:13%;">Date Revised</td>
      <td class="center" style="width:23%;">19-05-2026</td>
    </tr>
    <tr><td class="field-label">Effective Date</td><td class="center">19-05-2026</td></tr>
    <tr><td class="field-label">Rev./Issue No.</td><td class="center">01 / 00</td></tr>
    <tr><td class="field-label">Page No.</td><td class="center">1 of 1</td></tr>
  </table>

  <div class="center bold tiny" style="padding:4px 0;">
    ANY MODIFICATION TO THIS DOCUMENT SHALL BE THROUGH CQMC ONLY.
    THINK DIGITAL. WORK SMART. SAVE PLANET.
  </div>

  <table>
    <tr>
      <td class="field-label">Employee No.</td>
      <td>${escapeHtml(form?.employeeGasId)}</td>
      <td class="field-label">Division</td>
      <td>${escapeHtml(form?.projectName || "LEAVE")}</td>
      <td class="field-label">Request No.</td>
      <td>${escapeHtml(requestNo)}</td>
    </tr>
    <tr>
      <td class="field-label">Employee Name</td>
      <td colspan="3">${escapeHtml(form?.employeeName)}</td>
      <td class="field-label">Position</td>
      <td>${escapeHtml(form?.position)}</td>
    </tr>
    <tr>
      <td class="field-label">Request Date</td>
      <td>${formatDate(form?.requestDate)}</td>
      <td class="field-label">Leave Start Date</td>
      <td>${formatDate(form?.startDate)}</td>
      <td class="field-label">Leave End Date</td>
      <td>${formatDate(form?.endDate)}</td>
    </tr>
    <tr>
      <td class="field-label">Leave Type:</td>
      <td colspan="5">
        <span class="checkbox">${checkMark(type === "annual_leave")}</span> ANNUAL
        <span class="checkbox">${checkMark(type === "unpaid_leave")}</span> UNPAID
        <span class="checkbox">${checkMark(type === "emergency_leave")}</span> EMERGENCY
        <span class="checkbox">${checkMark(type === "sick_leave")}</span> OTHER:
        ${type === "sick_leave" ? "SICK LEAVE" : ""}
      </td>
    </tr>
  </table>

  <table style="margin-top:5px;">
    <tr>
      <td class="section" colspan="3">LEAVE DETAILS (TO BE FILLED BY REQUESTOR)</td>
      <td class="section" colspan="3">REVIEW AND COMMENTS (TO BE FILLED BY HRPM)</td>
    </tr>
    <tr>
      <td class="field-label">Total Vacation Balance</td>
      <td colspan="2">${escapeHtml(balance.total)}</td>
      <td colspan="3">
        <span class="checkbox">✓</span> LEAVE APPROVED
        <span class="checkbox"></span> LEAVE NOT APPROVED
        <span class="checkbox"></span> LEAVE RE-SCHEDULED
      </td>
    </tr>
    <tr>
      <td class="field-label">Number of Days Applied For</td>
      <td colspan="2">${escapeHtml(balance.days)}</td>
      <td colspan="3">
        <span class="checkbox"></span> LEAVE APPROVED WITH CONDITION
        <span class="checkbox">${checkMark(type === "unpaid_leave")}</span> LEAVE APPROVED (UNPAID)
      </td>
    </tr>
    <tr>
      <td class="field-label">Total Leave Days</td>
      <td colspan="2">${escapeHtml(balance.days)}</td>
      <td class="field-label" colspan="3">Comments / Justification</td>
    </tr>
    <tr>
      <td class="field-label">Balance of Unused Leave</td>
      <td colspan="2">${escapeHtml(balance.remaining)}</td>
      <td rowspan="4" colspan="3" style="height:72px;vertical-align:top;">
        ${escapeHtml(form?.note || "")}
      </td>
    </tr>
    <tr><td class="field-label">Vacation Salary</td><td class="center">YES</td><td class="center">NO</td></tr>
    <tr><td class="field-label">Exit Re-Entry</td><td class="center">YES</td><td class="center">NO</td></tr>
    <tr><td class="field-label">Ticket</td><td class="center">YES</td><td class="center">NO</td></tr>
  </table>

  <table style="margin-top:5px;">
    <tr><td class="section" colspan="4">TRAVEL DETAILS</td></tr>
    <tr>
      <td class="field-label">Travel Details</td>
      <td class="field-label center">Date</td>
      <td class="field-label center">From</td>
      <td class="field-label center">To</td>
    </tr>
    <tr><td class="field-label">Departure</td><td></td><td></td><td></td></tr>
    <tr><td class="field-label">Return</td><td></td><td></td><td></td></tr>
    <tr><td class="field-label">Rejoining</td><td></td><td></td><td></td></tr>
  </table>

  <table style="margin-top:5px;">
    <tr>
      <td class="section" colspan="4">
        THE “HOME CONTACT & ADDRESS” FOR THE DURATION OF THE LEAVE WILL BE
      </td>
    </tr>
    <tr><td class="field-label">Telephone No.</td><td></td><td class="field-label">Mobile No.</td><td></td></tr>
    <tr><td class="field-label">Address</td><td colspan="3"></td></tr>
    <tr>
      <td class="section" colspan="4">
        THE “EMERGENCY CONTACT ADDRESS” FOR THE DURATION OF THE LEAVE WILL BE –
        FIRST-DEGREE RELATIVE
      </td>
    </tr>
    <tr><td class="field-label">Telephone No.</td><td></td><td class="field-label">Mobile No.</td><td></td></tr>
    <tr><td class="field-label">Address</td><td colspan="3"></td></tr>
  </table>

  <table style="margin-top:5px;">
    <tr><td class="section" colspan="3">INITIATOR AND APPROVERS</td></tr>
    <tr>
      <td class="field-label center">Requested By</td>
      <td class="field-label center">Acknowledge By</td>
      <td class="field-label center">Approved By</td>
    </tr>
    <tr class="signature-space">
      <td class="center">${escapeHtml(form?.requestedByName || form?.employeeName)}</td>
      <td></td>
      <td class="center">${escapeHtml(form?.reviewerName)}</td>
    </tr>
  </table>

  <div class="footer-note">
    <span>Generated Date: ${formatDate(form?.generatedAt || new Date())}</span>
    <span>Leave Type: ${escapeHtml(labelLeaveType(form?.type))}</span>
    <span>Reviewed Date: ${formatDate(form?.reviewedAt)}</span>
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
      landscape: true,
      printBackground: true,
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
