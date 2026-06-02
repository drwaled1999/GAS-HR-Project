import express from "express";
import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
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

// الحل النهائي: الشعار مدمج كودياً بصيغة Base64 النقي ليعمل بشكل مستقل تماماً عن السيرفر وملفاته
function getGasLogoDataUri() {
  return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKAAAABACAYAAABf397BAAAABGdBTUEAALGPC/xhBQAAACBjSFJNAAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAAACXBIWXMAAB2EAAAdhAGi4X6EAAAAHHRFWHRTb2Z0d2FyZQBBZG9iZSBGaXJld29ya3MgQ1M26wstNQAACulJREFUeF7tnAtwVNUZx393N5vEPIgYEkA0gYg8bKBURHwUpSIdbAtatVat7bSdaatOH63T9mG09bWdaTv96LSdHqfT1g6tU7FisSAtKk95KAIivpInSICEvJJsd7O72+fc3YubbHY3u9ndbLL/M7N39569e8893/n+v3PeuffuEsbGRm0wSgN9gP7AIGAwMBgYDAwGBgODgcFAYWAwUBgYDBQGBgOFgcFAYWAwUBgYDBQGBpP0B0b/P9pAdscI3U6S9wXwGeBw0r8X8DjwfeCvgf0Z0B+XAd6P63b0LgO7S8DeDHiV63p0v03A0bhuR/fT6GfW9e7vE8BfAnuB3wG7gZ8AnwG+CXwN+CrwZeDLwJeAnwE/A74IfAn4IvA54EvAF4DPA/vofvTdB/Y+uv6Srh9wbeDngX009p00P0LpD76u76PrXm6vO9D1A7l9g7nu7fsa0/fN+P7N+P7N6Ps3outf6P6XgO8A3wa+S+9eBr6Hvr+Crt8O7AbeBbyG7gugv3g6F90vAs7Fp8W+w2v0U/bAfcAtwGZ8/wHgn3vLgYwA7m6eLwD3AD8Dfgo4YHeP9u2S3p/Z3T3M9wZf+3ZgE737BHA3ffvFmO8Fff96ev9u3Nf7X6P7mP/u6P5u+vYw/83A79Hfe9vXw9fuW/wI6G8D/86p6f17gXw6vF0T58vA/SgP7gR+S98fQvdb6f0W9G0Lffst+vdbwA+ArwO/oPdX0ftvAX9A3wugvxZfF8f+Xm4bH4P++Fzg/wAn6e/tK7Zf78M/gS+wY8cW9A9b6D9vQf/+C3q/Ff18M323mZfF9vS1M36E/r0wNtbT8Y6Lg/uYfwu6Xwz9vW2ZtZ8Axt9tAn+XAb+XgZ8CP8X3D8vAL/G9mD4vA9/E98f6vgz/AnidKbyXF9LgG/C9mX78PPD7+HYmDb4BX2ZiwvS5ZfoBvAzeR9vO6fNidCymf7gEXovXvgz8mIkuYV/v+D4OftXGf6L7f0PfO9A/wLf36XgfeX8NfcY+MreP/P8FfY0Zf+T+GvX1uO9n1D/CfZfSffO90df6uO/3Bf9O/XN+vM6F1/r6b39A/Y/wZ6S/t3vA//0m8D+m9W9b+K1GfG8L9/0I+CO9f9uK6U0pve0Gf6SvvzSffreM7u00pA+n+D+E32r692F0vwVfZ49l+vA6X/876ffZp33FPhv2B/+U0S9f8X93Bf+U8X366v7q+vF6P8+v7m92Z2f6uK+W7o3wNcb6D+YV4C8vAt+L7z8D/pY97m7mN/RuhwX+9fjfWfC3pP9wEfhbiv8p/Zsyv9uCvwX/m4G/m9aP7v/F19+m4S8p83wT/mP87yD/Bvj6uI7tN+O/pXffFvwXgK9Rf0v9C7vOfwnf68vY9vCXZXz9gX+F3w6/65fRf/1G77bF/7YEvp6Of0r/tsb3Ff9G/bXw36X+TfFv9K+Pfwf7vDjwD/idC/+00R/4S9K7LfGfD9+r/W4p/G8NfN/g/97Avyn93wG+O/DfM+Dvo/+u0ft6Wv9p0/+59D+1f6b/vH7m7xO+pvn7Xfpf+j+v38Cvv9f6/wF+5bV8LbxC69fR/wK6fwXfN/j7Bf8f8Pcn8Ovwfx/vE66h3wH8I7yPrwP+799F6v+A7u/hfTy6vwS7GZ476f4P4Nl0vxi7Gd1fMvvvw3XmOfD34Dk9v5fevwy7GbeXGdyVwO8wXnfw/EaG627gOnYv7g9kuD6M/6Lw+n8D92fA3YvbyfA8Yffidw+9/wS4bgb3Eexm3Anj2b34be9P99/A8z1gE7vWvwG7wzjfCP9G7A/w2wTuXnrv6WvvD3wX2ATeC79F308w8YV8B9wBbyzYxL6C26L3XvP3Ovy9wP7Av9b/7Z/tE3339mX67vH5Pv4fBfU128HwPWC/8Aasv0Yj6i95A0Xfe8V+N7B/gP86YF9m/zXg/2XG98Wb8E6496W+6j9X7M/E/6O+/rG/mX72wOswgR+0f/D6bA/YFvxfD/z1mN+46Yy9xox+L/A3Yn8VbAL/bOAvxG/b36b7L8H/Svy2/R3g/2L6R/7+0vBf9Pf3yPh8wX/E/vbx8X0BftvvC/7F9G9bH/CPhf996d9Z6gP+Gfq/r8WvYffZ8H0Nfo09Fp6/Ar+G3eeA3XmFwL7G6w8Z/6X7b/B/X2b/g8BfiV87f5vvOvh7wE/+n5f9p7uCvw/+t9F/YfR+7Qf+C+DvA3vF79uM+y3Y7wK/7ff9wX/Y/g6O3++b/LbfP8A/7H8A/u70fwf/fX8B+A7m7wT+9pT/HfzV/3fwt6P/Vf9/G68/8Kvw7+Cvvv9rM94O/oN+Lwz8B/39AfgO6e9D8R/S38f6b//vI++v4f+R/rf998iZ/S/y/yD9b/tvg7+7t4uB/6C+P2Tf1/pvw79D3x+y+6f2D+p/C/4O9f9HMP4Z+v5g/Nn+v4Xfv9E/qO97C/U/D/97mP9Z6v9Z6v8W7GeorxH0XwP+DqEfo74N6v+P0D+o/1nw7wD+v16/R6ZfWw6O/X2Z/g/Z9X9U9fN/X/gL17m/ZPhvof9E/bU/0/8wHn/U03/w/C3g/0H6E+B+A/itvP+96b/D8P3X9XmOfgP/ofRvXwF9/vE9ZPfH6O+h+1XoX4n+7ev/P0bfr4Hfwbvdv8G7v9ff35f6+93F/wWv36XfS79XonfDvsb/vR6/wD7r+39O/Vf09bju63FfsL/G2I/wR9V/A797eT6C/uX080byBf/L8Efh16f1X58/P4vXFfXW508oH2/m5fV98wvwX6X/P16/i6+/C/4o/XwTfK/XFfXfxdffhP8q/XfR+8vAv0rffxd/pM/D/Anl/83Ufxa976XnveD9Z6D3Z3reS89H0fsWep4Fbyzv7yL/Aun/X9Xfvwn+7fTfBf8I3/un/Y/wZ+X/S9W/Xb+/1N9z7/0FfR7g77n3UfgNfAeg9wb/eP8R9HngvwX876Tng/S8nZ63ofct4G+l5wF475/2D/PvlL8n7fcl+wF+w98+ev8BvP7bYgO/P8O3wDbgO+A+wO8X/O0mBvTfeBPeXvjWwr8F/FvBvwX/LfT/wZg9+m/w397wexZfA78D7oPfgf0p6Wb62oD/VszfeBP+X9S3CewB99G2ZfTfQNsm8FuBtwHfArfTtkDbeBv63gS3D94+ePvAvwV8G6vAfgv/FvC3gW9D3xb6t2C/Bf9N6Nu0r4XfAr8A3wX3v9Q30P4W2gNuoDfg9vFvgD9Anwf49pXp/wDbp9D79u9g/z4y/T9Kvx+l/UfYP0g/wY59Bfb7Y39fGv9p/9S/Xvunfe9B31+v7wev89D96PnX6/9N6H4vun8G3X+990fQPwP664D96L/X55vQ7fW+FvS7ZfQt9O31/pDeX+uT3p/p++vef9u31/uAfp+Nvl9mH/+H1/+Lrv9D0P/B+78I/pDWD/p+EPo9ev+W/v/7+P+C790XgN1V+D0Xg9/Xen96XgO/52D/9vP/AtvPvwzcnXl+O7y/PfYw7rf98Efs95D/bfr/g99bYFvnO9vB/gXbA78XbE/fe6N36XsreIHeBe8B24vtoHfh/QG+v6bvfWv8F+v9/0bfa8D3XvP3Yv5fBex/Ab6B3YFf8A8G+Ab6/g6+gTeO/wH+wQDbP9t/YID/v+0f1L++wYDBwGBgMFAYGAwUBgYDo4F/As9BscB6K/m3AAAAAElFTkSuQmCC";
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
  const isApproved = form?.status?.toLowerCase() === "approved";

  const checkStr = (condition) => (condition ? "☒" : "☐");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Leave Request Form</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 8mm;
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
      line-height: 1.2;
    }

    .page {
      width: 100%;
      max-width: 194mm;
      margin: 0 auto;
      position: relative;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      margin-bottom: 0px;
    }

    td {
      border: 1px solid #000;
      padding: 5px 6px;
      vertical-align: middle;
      font-size: 10.5px;
    }

    .center { text-align: center; }
    .bold { font-weight: 700; }
    .upper { text-transform: uppercase; }

    .header-table td {
      padding: 0;
    }
    
    .logo-cell {
      width: 25%;
      text-align: center;
      vertical-align: middle;
      padding: 4px;
    }

    .logo-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-family: Arial, sans-serif;
    }

    .gas-logo-img {
      width: 115px;
      max-height: 45px;
      object-fit: contain;
    }

    .arabic-logo-text {
      font-size: 10.5px;
      font-weight: bold;
      margin-top: 1px;
    }

    .english-logo-text {
      font-size: 8.5px;
      font-weight: bold;
      color: #000;
    }

    .title-cell {
      width: 50%;
      text-align: center;
    }

    .qms-title {
      font-size: 11px;
      font-weight: 700;
      padding: 5px 0;
      border-bottom: 1px solid #000;
    }

    .form-title {
      font-size: 21px;
      font-weight: 700;
      padding: 4px 0;
      border-bottom: 1px solid #000;
      letter-spacing: 0.5px;
    }

    .form-code {
      font-size: 11px;
      font-weight: 700;
      padding: 4px 0;
    }

    .meta-label {
      width: 13%;
      font-weight: 700;
      font-size: 10px;
      padding: 4px 6px;
    }

    .meta-value {
      width: 12%;
      text-align: center;
      font-size: 10px;
      padding: 4px 6px;
    }

    .notice-top {
      text-align: center;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 7.5px;
      font-weight: 700;
      padding: 5px 0;
    }

    .field-label {
      font-weight: 700;
      text-transform: uppercase;
      background: #f3f3f3;
      font-size: 10px;
    }

    .field-value {
      font-weight: 700;
    }

    .spacer {
      height: 12px;
    }

    .chk-box {
      font-family: "Times New Roman", serif;
      font-size: 13px;
      margin-right: 4px;
      vertical-align: middle;
      font-weight: normal;
    }

    .option-group {
      display: flex;
      justify-content: flex-start;
      gap: 45px;
    }

    .section-title {
      text-align: center;
      font-weight: 700;
      text-transform: uppercase;
      background: #f3f3f3;
      font-size: 11px;
      padding: 4px;
    }

    .section-title em {
      font-size: 9px;
      font-style: italic;
      font-weight: normal;
    }

    .review-cell {
      vertical-align: top;
      padding: 8px 10px;
    }

    .review-item {
      display: block;
      margin-bottom: 5px;
      font-weight: 700;
    }

    .comments-box {
      height: 52px;
      vertical-align: top;
      font-size: 10px;
      padding: 6px;
    }

    .signature-title {
      background: #f3f3f3;
      font-weight: 700;
      text-transform: uppercase;
      padding: 4px 6px;
    }

    .signature-name {
      height: 60px;
      text-align: center;
      vertical-align: middle;
      font-weight: 700;
    }

    .footer {
      position: absolute;
      left: 0;
      right: 0;
      bottom: -8mm;
      display: flex;
      justify-content: space-between;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 7.5px;
      font-weight: 700;
      border-top: 1px solid #000;
      padding-top: 4px;
    }

    .no-border {
      border: none !important;
    }
  </style>
</head>

<body>
  <div class="page">
    <table class="header-table">
      <tr>
        <td rowspan="3" class="logo-cell">
          <div class="logo-container">
            ${
              logoDataUri
                ? `<img class="gas-logo-img" src="${logoDataUri}" alt="GAS Logo" />`
                : `<span style="font-size:22px; font-weight:bold; color:#007c89; font-family:Arial;">GAS</span>`
            }
            <div class="arabic-logo-text">جاز العربية للخدمات</div>
            <div class="english-logo-text">GAS ARABIAN SERVICES</div>
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
            <span style="border-bottom: 1px solid #000; padding-right: 120px; font-weight: bold; margin-left: 4px;">
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
          <span class="review-item"><span class="chk-box">☐</span> LEAVE NOT APPROVED</span>
          <span class="review-item"><span class="chk-box">☐</span> LEAVE RE-SCHEDULED</span>
          <span class="review-item"><span class="chk-box">☐</span> LEAVE APPROVED WITH CONDITION</span>
          <span class="review-item"><span class="chk-box">${checkStr(isApproved && isUnpaid)}</span> LEAVE APPROVED (UNPAID)</span>
        </td>
      </tr>
      <tr>
        <td class="field-label">NUMBER OF DAYS APPLIED FOR</td>
        <td class="center">${escapeHtml(balance.days)}</td>
      </tr>
      <tr>
        <td class="field-label">TOTAL LEAVE DAYS</td>
        <td class="center">${escapeHtml(balance.days)}</td>
      </tr>
      <tr>
        <td class="field-label">BALANCE OF UNUSED LEAVE</td>
        <td class="center">${escapeHtml(balance.remaining)}</td>
      </tr>
      <tr>
        <td class="field-label">VACATION SALARY</td>
        <td class="center">
          <span style="margin-right: 8px;"><span class="chk-box">☐</span> YES</span>
          <span><span class="chk-box">☐</span> NO</span>
        </td>
      </tr>
      <tr>
        <td class="field-label">EXIT RE-ENTRY</td>
        <td class="center">
          <span style="margin-right: 8px;"><span class="chk-box">☐</span> YES</span>
          <span><span class="chk-box">☐</span> NO</span>
        </td>
        <td colspan="2" rowspan="2" class="comments-box">
          <div class="bold" style="margin-bottom: 2px;">Comments/Justification:</div>
          <div style="font-weight: normal; white-space: pre-wrap;">${escapeHtml(form?.note || "")}</div>
        </td>
      </tr>
      <tr>
        <td class="field-label">TICKET</td>
        <td class="center">
          <span style="margin-right: 8px;"><span class="chk-box">☐</span> YES</span>
          <span><span class="chk-box">☐</span> NO</span>
        </td>
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
      <tr>
        <td class="field-label">DEPARTURE</td>
        <td></td>
        <td></td>
        <td></td>
      </tr>
      <tr>
        <td class="field-label">RETURN</td>
        <td></td>
        <td></td>
        <td></td>
      </tr>
      <tr>
        <td class="field-label">REJOINING</td>
        <td></td>
        <td></td>
        <td></td>
      </tr>
    </table>

    <div class="spacer"></div>

    <table>
      <tr>
        <td class="section-title" colspan="4">
          THE "HOME CONTACT & ADDRESS" FOR THE DURATION OF THE LEAVE WILL BE
        </td>
      </tr>
      <tr>
        <td class="field-label" style="width: 20%;">TELEPHONE NO.</td>
        <td style="width: 30%;"></td>
        <td class="field-label" style="width: 20%;">MOBILE NO.</td>
        <td style="width: 30%;"></td>
      </tr>
      <tr>
        <td class="field-label">ADDRESS</td>
        <td colspan="3"></td>
      </tr>
    </table>

    <div class="spacer"></div>

    <table>
      <tr>
        <td class="section-title" colspan="4">
          THE "EMERGENCY CONTACT ADDRESS" FOR THE DURATION OF THE LEAVE WILL BE - FIRST-DEGREE RELATIVE
        </td>
      </tr>
      <tr>
        <td class="field-label" style="width: 20%;">TELEPHONE NO.</td>
        <td style="width: 30%;"></td>
        <td class="field-label" style="width: 20%;">MOBILE NO.</td>
        <td style="width: 30%;"></td>
      </tr>
      <tr>
        <td class="field-label">ADDRESS</td>
        <td colspan="3"></td>
      </tr>
    </table>

    <div class="spacer"></div>

    <table>
      <tr>
        <td class="signature-title" colspan="3">INITIATOR AND APPROVERS</td>
      </tr>
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
        top: "10mm",
        right: "8mm",
        bottom: "10mm",
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
