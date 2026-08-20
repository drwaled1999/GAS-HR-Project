import express from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import { fileURLToPath } from "url";
import { query } from "../data/index.js";
import { requireAuth } from "../middleware_auth.js";
import { createNotificationRepo } from "../data/leaveNotificationRepository.js";
import cloudinary from "../utils/cloudinary.js";

const router = express.Router();

router.use(requireAuth);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, "../uploads/requests");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// النظام القديم نخليه موجود احتياط
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const safeOriginal = String(file.originalname || "file")
      .replace(/[^\w.\-]+/g, "_")
      .slice(-120);

    cb(null, `${Date.now()}-${safeOriginal}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 8 * 1024 * 1024,
  },
});

// هذا المستخدم فعليًا مع Cloudinary
const uploadCloud = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024,
  },
});

function normalizeRole(value) {
  return String(value || "").trim().toLowerCase();
}

function isSystemOwner(user) {
  const role = normalizeRole(user?.roleName || user?.role || user?.roleCode);
  return [
    "system owner",
    "owner",
    "system_owner",
  ].includes(role);
}

async function ensureRequestManagersTable() {
  await query(`CREATE TABLE IF NOT EXISTS request_managers (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    assigned_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
}

async function ensureRequestWorkflowTables() {
  await ensureRequestManagersTable();
  await query(`ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES users(id) ON DELETE SET NULL`);
  await query(`ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ`);
  await query(`CREATE TABLE IF NOT EXISTS request_type_managers (
    type_code TEXT NOT NULL, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(type_code,user_id))`);
  await query(`CREATE TABLE IF NOT EXISTS request_internal_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), request_id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, comment TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  await query(`CREATE TABLE IF NOT EXISTS request_sla_notifications (
    request_id TEXT PRIMARY KEY,
    notified_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
}

async function canManageRequests(user) {
  if (isSystemOwner(user)) return true;
  if (!user?.id) return false;
  await ensureRequestManagersTable();
  const result = await query(`SELECT 1 FROM request_managers WHERE user_id=$1 LIMIT 1`, [user.id]);
  return Boolean(result.rows[0]);
}

function canManageLeaveBalances(user) {
  const role = normalizeRole(user?.roleName || user?.role || user?.roleCode);
  const permissions = Array.isArray(user?.permissions)
    ? user.permissions.map((item) => String(item || "").trim().toLowerCase())
    : [];

  if (
    [
      "system owner",
      "owner",
      "system_owner",
      "hr manager",
      "hr_manager",
      "hr",
      "hr admin",
      "hr_admin",
    ].includes(role)
  ) {
    return true;
  }

  return permissions.includes("leave.manage");
}

function sanitizePublicIdPart(value) {
  return String(value || "file")
    .replace(/\.[^/.]+$/, "")
    .replace(/[^\w\-]+/g, "_")
    .slice(0, 80);
}

async function uploadBufferToCloudinary(file, folder = "hr-requests") {
  if (!file?.buffer) return null;

  const originalName = String(file.originalname || "file");
  const publicId = `${Date.now()}-${sanitizePublicIdPart(originalName)}`;

  const isPdf =
    file.mimetype === "application/pdf" ||
    originalName.toLowerCase().endsWith(".pdf");

  return await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        resource_type: isPdf ? "raw" : "image",
        type: "upload",
        access_mode: "public",
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    stream.end(file.buffer);
  });
}

async function ensureSystemSettingsRow() {
  await query(`
    CREATE TABLE IF NOT EXISTS system_settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      annual_default_balance INTEGER NOT NULL DEFAULT 30,
      sick_default_balance INTEGER NOT NULL DEFAULT 15,
      emergency_default_balance INTEGER NOT NULL DEFAULT 5,
      maintenance_mode BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  const existing = await query(`
    SELECT id
    FROM system_settings
    LIMIT 1
  `);

  if (!existing.rows[0]) {
    await query(`
      INSERT INTO system_settings (
        annual_default_balance,
        sick_default_balance,
        emergency_default_balance,
        maintenance_mode,
        updated_at
      )
      VALUES (30, 15, 5, FALSE, NOW())
    `);
  }
}

async function getSystemLeaveDefaults() {
  await ensureSystemSettingsRow();

  const result = await query(`
    SELECT
      annual_default_balance AS "annualDefaultBalance",
      sick_default_balance AS "sickDefaultBalance",
      emergency_default_balance AS "emergencyDefaultBalance"
      ,monthly_annual_accrual AS "monthlyAnnualAccrual"
    FROM system_settings
    LIMIT 1
  `);

  return (
    result.rows[0] || {
      annualDefaultBalance: 30,
      sickDefaultBalance: 15,
      emergencyDefaultBalance: 5,
      monthlyAnnualAccrual: 2.5,
    }
  );
}

async function ensureLeavePolicies() {
  await query(`CREATE TABLE IF NOT EXISTS hr_leave_policies (
    code TEXT PRIMARY KEY, label TEXT NOT NULL, default_balance NUMERIC(10,2) NOT NULL,
    monthly_accrual NUMERIC(10,2) NOT NULL DEFAULT 0, max_days_per_request INTEGER NOT NULL DEFAULT 30,
    allow_negative BOOLEAN NOT NULL DEFAULT FALSE, exclude_weekends BOOLEAN NOT NULL DEFAULT TRUE,
    attachment_allowed BOOLEAN NOT NULL DEFAULT FALSE, attachment_required BOOLEAN NOT NULL DEFAULT FALSE,
    carry_over_max NUMERIC(10,2) NOT NULL DEFAULT 0, updated_by TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  await query(`INSERT INTO hr_leave_policies (code,label,default_balance,monthly_accrual,max_days_per_request,attachment_allowed)
    SELECT seed.* FROM (VALUES ('annual_leave','Annual Leave',30::numeric,2.5::numeric,30,TRUE),
      ('sick_leave','Sick Leave',15::numeric,0::numeric,30,FALSE),
      ('emergency_leave','Emergency Leave',5::numeric,0::numeric,5,FALSE))
      AS seed(code,label,default_balance,monthly_accrual,max_days_per_request,attachment_allowed)
    WHERE NOT EXISTS (SELECT 1 FROM hr_leave_policies existing WHERE existing.code=seed.code)`);
}

async function getLeavePolicy(code) {
  await ensureLeavePolicies();
  const { rows } = await query(`SELECT code, label, default_balance AS "defaultBalance",
    monthly_accrual AS "monthlyAccrual", max_days_per_request AS "maxDaysPerRequest",
    allow_negative AS "allowNegative", exclude_weekends AS "excludeWeekends",
    attachment_allowed AS "attachmentAllowed", attachment_required AS "attachmentRequired",
    carry_over_max AS "carryOverMax" FROM hr_leave_policies WHERE code=$1 LIMIT 1`, [code]);
  return rows[0] || null;
}

async function ensureLeaveBalancesTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS leave_balances (
      id SERIAL PRIMARY KEY,
      employee_id UUID NOT NULL UNIQUE,
      balance INTEGER NOT NULL DEFAULT 30,
      user_id UUID NULL
    );
  `);

  await query(`ALTER TABLE leave_balances ADD COLUMN IF NOT EXISTS annual_balance INTEGER`);
  await query(`ALTER TABLE leave_balances ADD COLUMN IF NOT EXISTS annual_used INTEGER NOT NULL DEFAULT 0`);
  await query(`ALTER TABLE leave_balances ADD COLUMN IF NOT EXISTS sick_balance INTEGER NOT NULL DEFAULT 15`);
  await query(`ALTER TABLE leave_balances ADD COLUMN IF NOT EXISTS sick_used INTEGER NOT NULL DEFAULT 0`);
  await query(`ALTER TABLE leave_balances ADD COLUMN IF NOT EXISTS emergency_balance INTEGER NOT NULL DEFAULT 5`);
  await query(`ALTER TABLE leave_balances ADD COLUMN IF NOT EXISTS emergency_used INTEGER NOT NULL DEFAULT 0`);
  await query(`ALTER TABLE leave_balances ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW()`);
  await query(`ALTER TABLE leave_balances ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW()`);

  await query(`
    UPDATE leave_balances
    SET annual_balance = COALESCE(balance, 30)
    WHERE annual_balance IS NULL
  `);

  await query(`
    UPDATE leave_balances
    SET annual_balance = 30
    WHERE annual_balance IS NULL
  `);
}

async function ensureLeaveReviewAttachmentColumns() {
  await query(`
    ALTER TABLE leave_requests
    ADD COLUMN IF NOT EXISTS review_attachment_name TEXT
  `);

  await query(`
    ALTER TABLE leave_requests
    ADD COLUMN IF NOT EXISTS review_attachment_path TEXT
  `);

  await query(`
    ALTER TABLE leave_requests
    ADD COLUMN IF NOT EXISTS review_attachments JSONB DEFAULT '[]'::jsonb
  `);
}

async function ensureEmployeeLeaveBalance(employeeId) {
  if (!employeeId) return null;

  await ensureLeaveBalancesTable();
  const defaults = await getSystemLeaveDefaults();

  const existing = await query(
    `
    SELECT *
    FROM leave_balances
    WHERE employee_id = $1
    LIMIT 1
    `,
    [employeeId]
  );

  if (existing.rows[0]) {
    return existing.rows[0];
  }

  const inserted = await query(
    `
    INSERT INTO leave_balances (
      employee_id,
      annual_balance,
      annual_used,
      sick_balance,
      sick_used,
      emergency_balance,
      emergency_used,
      created_at,
      updated_at
    )
    VALUES ($1, $2, 0, $3, 0, $4, 0, NOW(), NOW())
    RETURNING *
    `,
    [
      employeeId,
      defaults.annualDefaultBalance,
      defaults.sickDefaultBalance,
      defaults.emergencyDefaultBalance,
    ]
  );

  return inserted.rows[0] || null;
}

function calculateRequestedDays(startDate, endDate, excludeWeekends = false) {
  if (!startDate) return 1;

  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date(startDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 1;
  }

  const startOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());

  if (endOnly < startOnly) return 0;
  let days = 0;
  for (const cursor = new Date(startOnly); cursor <= endOnly; cursor.setDate(cursor.getDate() + 1)) {
    if (excludeWeekends && (cursor.getDay() === 5 || cursor.getDay() === 6)) continue;
    days += 1;
  }
  return days;
}

async function applyLeaveDeduction(currentRequest) {
  const leaveType = String(currentRequest.type || "").trim().toLowerCase();

  if (!["annual_leave", "emergency_leave", "sick_leave"].includes(leaveType)) {
    return;
  }

  const employeeId = currentRequest.employee_id;
  if (!employeeId) return;

  const balance = await ensureEmployeeLeaveBalance(employeeId);
  if (!balance) return;
  const policy = await getLeavePolicy(leaveType);
  const days = calculateRequestedDays(currentRequest.start_date, currentRequest.end_date, policy?.excludeWeekends);

  if (leaveType === "annual_leave") {
    const remaining = Number(balance.annual_balance || 0) - Number(balance.annual_used || 0);
    if (!policy?.allowNegative && remaining < days) {
      throw new Error("Insufficient annual leave balance");
    }

    await query(
      `
      UPDATE leave_balances
      SET
        annual_used = annual_used + $2,
        updated_at = NOW()
      WHERE employee_id = $1
      `,
      [employeeId, days]
    );
    return;
  }

  if (leaveType === "emergency_leave") {
    const remaining =
      Number(balance.emergency_balance || 0) - Number(balance.emergency_used || 0);
    if (!policy?.allowNegative && remaining < days) {
      throw new Error("Insufficient emergency leave balance");
    }

    await query(
      `
      UPDATE leave_balances
      SET
        emergency_used = emergency_used + $2,
        updated_at = NOW()
      WHERE employee_id = $1
      `,
      [employeeId, days]
    );
    return;
  }

  if (leaveType === "sick_leave") {
    const remaining = Number(balance.sick_balance || 0) - Number(balance.sick_used || 0);
    if (!policy?.allowNegative && remaining < days) {
      throw new Error("Insufficient sick leave balance");
    }

    await query(
      `
      UPDATE leave_balances
      SET
        sick_used = sick_used + $2,
        updated_at = NOW()
      WHERE employee_id = $1
      `,
      [employeeId, days]
    );
  }
}

async function reverseLeaveDeduction(currentRequest) {
  const leaveType = String(currentRequest.type || "").trim().toLowerCase();

  if (!["annual_leave", "emergency_leave", "sick_leave"].includes(leaveType)) {
    return;
  }

  const employeeId = currentRequest.employee_id;
  if (!employeeId) return;

  const policy = await getLeavePolicy(leaveType);
  const days = calculateRequestedDays(currentRequest.start_date, currentRequest.end_date, policy?.excludeWeekends);

  const usedColumn =
    leaveType === "annual_leave"
      ? "annual_used"
      : leaveType === "emergency_leave"
      ? "emergency_used"
      : "sick_used";

  await ensureEmployeeLeaveBalance(employeeId);

  await query(
    `
    UPDATE leave_balances
    SET
      ${usedColumn} = GREATEST(COALESCE(${usedColumn}, 0) - $2, 0),
      updated_at = NOW()
    WHERE employee_id = $1
    `,
    [employeeId, days]
  );
}

async function resolveEmployee({
  employeeId,
  employee_id,
  employeeGasId,
  username,
  user,
}) {
  const directEmployeeId = employeeId || employee_id;

  if (directEmployeeId) {
    const result = await query(
      `
      SELECT id, gas_id, full_name
      FROM employees
      WHERE id = $1
      LIMIT 1
      `,
      [directEmployeeId]
    );

    if (result.rows[0]) return result.rows[0];
  }

  const gasIdCandidate = employeeGasId || user?.gasId || null;

  if (gasIdCandidate) {
    const result = await query(
      `
      SELECT id, gas_id, full_name
      FROM employees
      WHERE gas_id = $1
      LIMIT 1
      `,
      [String(gasIdCandidate)]
    );

    if (result.rows[0]) return result.rows[0];
  }

  const usernameCandidate = username || user?.username || null;

  if (usernameCandidate) {
    const result = await query(
      `
      SELECT
        e.id,
        e.gas_id,
        e.full_name
      FROM users u
      JOIN employees e
        ON e.id = u.employee_id
        OR e.gas_id = u.gas_id
      WHERE u.username = $1
      LIMIT 1
      `,
      [String(usernameCandidate)]
    );

    if (result.rows[0]) return result.rows[0];
  }

  return null;
}

router.get("/types", async (_req, res) => {
  try {
    await ensureLeavePolicies();
    const policiesResult = await query(`SELECT code, label,
      attachment_allowed AS "attachmentAllowed", attachment_required AS "attachmentRequired",
      max_days_per_request AS "maxDaysPerRequest", allow_negative AS "allowNegative",
      exclude_weekends AS "excludeWeekends" FROM hr_leave_policies ORDER BY code`);
    return res.json({
      types: [
        ...policiesResult.rows.map((policy) => ({
          code: policy.code, label: policy.label, requiresAttachment: policy.attachmentRequired,
          allowsAttachment: policy.attachmentAllowed, requiresDateRange: true,
          requiresBankFields: false, maxDaysPerRequest: policy.maxDaysPerRequest,
          allowNegative: policy.allowNegative, excludeWeekends: policy.excludeWeekends,
        })),
        {
          code: "salary_transfer",
          label: "تحويل راتب",
          requiresAttachment: false,
          requiresDateRange: false,
          requiresBankFields: true,
        },
        {
          code: "salary_certificate",
          label: "طلب تعريف بالراتب",
          requiresAttachment: false,
          requiresDateRange: false,
          requiresBankFields: false,
        },
        {
          code: "payslip_request",
          label: "طلب كشف راتب (Payslip)",
          requiresAttachment: false,
          requiresDateRange: false,
          requiresBankFields: false,
        },
      ],
    });
  } catch (error) {
    console.error("Request types error:", error);
    return res.status(500).json({ message: "Failed to load request types" });
  }
});

router.get("/access", async (req, res) => {
  try {
    const canManage = await canManageRequests(req.user);
    const pending = canManage ? await query(`SELECT COUNT(*)::int AS count FROM leave_requests WHERE status='pending'`) : { rows: [{ count: 0 }] };
    return res.json({ canManage, isSystemOwner: isSystemOwner(req.user), pendingCount: pending.rows[0]?.count || 0 });
  } catch (error) {
    return res.status(500).json({ message: "Failed to check request access" });
  }
});

router.get("/managers", async (req, res) => {
  try {
    if (!(await canManageRequests(req.user))) return res.status(403).json({ message: "No permission" });
    await ensureRequestManagersTable();
    await ensureRequestWorkflowTables();
    const result = await query(`SELECT u.id, u.username, COALESCE(u.full_name,u.name,u.username) AS name,
      EXISTS (SELECT 1 FROM request_managers rm WHERE rm.user_id=u.id) AS selected
      ,COALESCE((SELECT json_agg(rtm.type_code ORDER BY rtm.type_code) FROM request_type_managers rtm WHERE rtm.user_id=u.id),'[]'::json) AS "typeCodes"
      FROM users u WHERE u.is_active=TRUE ORDER BY COALESCE(u.full_name,u.name,u.username)`);
    return res.json({ users: result.rows || [] });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load request managers" });
  }
});

router.put("/managers", async (req, res) => {
  try {
    if (!isSystemOwner(req.user)) return res.status(403).json({ message: "Only the System Owner can manage request managers" });
    await ensureRequestManagersTable();
    const userIds = [...new Set((Array.isArray(req.body?.userIds) ? req.body.userIds : []).map(String).filter(Boolean))];
    const typeAssignments = req.body?.typeAssignments && typeof req.body.typeAssignments === "object" ? req.body.typeAssignments : {};
    await query(`WITH cleared AS (DELETE FROM request_managers)
      INSERT INTO request_managers(user_id,assigned_by)
      SELECT value::uuid, $2 FROM unnest($1::text[]) AS value
      ON CONFLICT DO NOTHING`, [userIds, req.user.id]);
    await query(`WITH cleared AS (DELETE FROM request_type_managers)
      INSERT INTO request_type_managers(type_code,user_id)
      SELECT entry.key, item.user_id::uuid FROM jsonb_each($1::jsonb) entry
      CROSS JOIN LATERAL jsonb_array_elements_text(entry.value) AS item(user_id)
      ON CONFLICT DO NOTHING`, [JSON.stringify(typeAssignments)]);
    return res.json({ message: "Request managers updated successfully", userIds });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update request managers" });
  }
});

router.put("/leave/:id/assign", async (req, res) => {
  try {
    if (!(await canManageRequests(req.user))) return res.status(403).json({ message: "No permission" });
    await ensureRequestWorkflowTables();
    const userId = String(req.body?.userId || "").trim();
    const allowed = await query(`SELECT u.id FROM users u JOIN request_managers rm ON rm.user_id=u.id WHERE u.id=$1 AND u.is_active=TRUE`, [userId]);
    if (!allowed.rows[0]) return res.status(400).json({ message: "Selected user is not an active request manager" });
    const updated = await query(`UPDATE leave_requests SET assigned_to=$2, assigned_at=NOW(), updated_at=NOW() WHERE id=$1 RETURNING id,type`, [req.params.id, userId]);
    if (!updated.rows[0]) return res.status(404).json({ message: "Request not found" });
    await createNotificationRepo(userId, `A request has been assigned to you (${updated.rows[0].type})`, "request_assignment", "/requests", { requestId: updated.rows[0].id });
    return res.json({ message: "Request assigned successfully" });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to assign request" });
  }
});

router.get("/leave/:id/comments", async (req, res) => {
  try {
    if (!(await canManageRequests(req.user))) return res.status(403).json({ message: "No permission" });
    await ensureRequestWorkflowTables();
    const result = await query(`SELECT c.id,c.comment,c.created_at AS "createdAt",
      COALESCE(u.full_name,u.name,u.username) AS "authorName" FROM request_internal_comments c
      LEFT JOIN users u ON u.id=c.user_id WHERE c.request_id=$1 ORDER BY c.created_at ASC`, [String(req.params.id)]);
    return res.json({ comments: result.rows || [] });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load internal comments" });
  }
});

router.post("/leave/:id/comments", async (req, res) => {
  try {
    if (!(await canManageRequests(req.user))) return res.status(403).json({ message: "No permission" });
    const comment = String(req.body?.comment || "").trim();
    if (!comment) return res.status(400).json({ message: "Comment is required" });
    if (comment.length > 2000) return res.status(400).json({ message: "Comment is too long" });
    await ensureRequestWorkflowTables();
    const result = await query(`INSERT INTO request_internal_comments(request_id,user_id,comment)
      VALUES($1,$2,$3) RETURNING id,comment,created_at AS "createdAt"`, [String(req.params.id), req.user.id, comment]);
    return res.json({ comment: { ...result.rows[0], authorName: req.user.fullName || req.user.name || req.user.username } });
  } catch (error) {
    return res.status(500).json({ message: "Failed to add internal comment" });
  }
});

router.get("/list", async (req, res) => {
  try {
    await ensureLeaveReviewAttachmentColumns();
    await ensureRequestWorkflowTables();

    const username = req.query.username || req.user?.username || null;

    const currentEmployee = await resolveEmployee({
      username,
      user: req.user,
    });

    const hasManagementAccess = await canManageRequests(req.user);
    const employeesResult = hasManagementAccess
      ? await query(`SELECT id, gas_id, full_name FROM employees ORDER BY full_name ASC`)
      : { rows: [] };

    const employees = (employeesResult.rows || []).map((row) => ({
      id: row.id,
      gasId: row.gas_id,
      name: row.full_name || row.gas_id,
    }));

    let leaveRequestsResult;

    if (hasManagementAccess) {
      leaveRequestsResult = await query(`
        SELECT
          lr.id,
          lr.employee_id AS "employeeId",
          lr.employee_id,
          COALESCE(lr.employee_gas_id, e.gas_id) AS "employeeGasId",
          COALESCE(lr.employee_name, e.full_name) AS "employeeName",
          lr.employee_name,
          lr.type,
          lr.note,
          lr.current_bank AS "currentBank",
          lr.new_bank AS "newBank",
          lr.new_iban AS "newIban",
          lr.start_date AS "startDate",
          lr.start_date,
          lr.end_date AS "endDate",
          lr.end_date,
          lr.status,
          lr.rejection_reason AS "rejectionReason",
          lr.requested_by_id AS "requestedById",
          req_user.username AS "requestedBy",
          COALESCE(req_user.full_name, req_user.name, req_user.username) AS "requestedByName",
          lr.reviewer_name AS "reviewerName",
          lr.reviewed_at AS "reviewedAt",
          lr.attachment_name AS "attachmentName",
          lr.attachment_path AS "attachmentPath",
          lr.review_attachment_name AS "reviewAttachmentName",
          lr.review_attachment_path AS "reviewAttachmentPath",
          lr.review_attachments AS "reviewAttachments",
          lr.created_at AS "createdAt"
          ,lr.assigned_to AS "assignedTo", COALESCE(assignee.full_name,assignee.name,assignee.username) AS "assignedToName"
        FROM leave_requests lr
        LEFT JOIN employees e ON e.id = lr.employee_id
        LEFT JOIN users req_user ON req_user.id = lr.requested_by_id
        LEFT JOIN users assignee ON assignee.id = lr.assigned_to
        ORDER BY lr.created_at DESC, lr.id DESC
      `);
    } else if (currentEmployee?.id) {
      leaveRequestsResult = await query(
        `
        SELECT
          lr.id,
          lr.employee_id AS "employeeId",
          lr.employee_id,
          COALESCE(lr.employee_gas_id, e.gas_id) AS "employeeGasId",
          COALESCE(lr.employee_name, e.full_name) AS "employeeName",
          lr.employee_name,
          lr.type,
          lr.note,
          lr.current_bank AS "currentBank",
          lr.new_bank AS "newBank",
          lr.new_iban AS "newIban",
          lr.start_date AS "startDate",
          lr.start_date,
          lr.end_date AS "endDate",
          lr.end_date,
          lr.status,
          lr.rejection_reason AS "rejectionReason",
          lr.requested_by_id AS "requestedById",
          req_user.username AS "requestedBy",
          COALESCE(req_user.full_name, req_user.name, req_user.username) AS "requestedByName",
          lr.reviewer_name AS "reviewerName",
          lr.reviewed_at AS "reviewedAt",
          lr.attachment_name AS "attachmentName",
          lr.attachment_path AS "attachmentPath",
          lr.review_attachment_name AS "reviewAttachmentName",
          lr.review_attachment_path AS "reviewAttachmentPath",
          lr.review_attachments AS "reviewAttachments",
          lr.created_at AS "createdAt"
          ,lr.assigned_to AS "assignedTo", COALESCE(assignee.full_name,assignee.name,assignee.username) AS "assignedToName"
        FROM leave_requests lr
        LEFT JOIN employees e ON e.id = lr.employee_id
        LEFT JOIN users req_user ON req_user.id = lr.requested_by_id
        LEFT JOIN users assignee ON assignee.id = lr.assigned_to
        WHERE lr.employee_id = $1
           OR lr.requested_by_id = $2
           OR COALESCE(lr.employee_gas_id, e.gas_id) = $3
        ORDER BY lr.created_at DESC, lr.id DESC
        `,
        [
          currentEmployee.id,
          req.user?.id || null,
          currentEmployee.gas_id || req.user?.gasId || "",
        ]
      );
    } else {
      leaveRequestsResult = { rows: [] };
    }

    return res.json({
      employees,
      leaveRequests: leaveRequestsResult.rows || [],
      attendanceAdjustments: [],
    });
  } catch (error) {
    console.error("Requests list error:", error);
    return res.status(500).json({ message: "Failed to load requests list" });
  }
});

router.get("/balances", async (req, res) => {
  try {
    const username = req.query.username || req.user?.username || null;

    const employee = await resolveEmployee({
      username,
      user: req.user,
    });

    const defaults = await getSystemLeaveDefaults();

    if (!employee) {
      return res.json({
        balances: {
          annual: Number(defaults.annualDefaultBalance ?? 30),
          annualUsed: 0,
          annualRemaining: Number(defaults.annualDefaultBalance ?? 30),
          sick: Number(defaults.sickDefaultBalance ?? 15),
          sickUsed: 0,
          sickRemaining: Number(defaults.sickDefaultBalance ?? 15),
          emergency: Number(defaults.emergencyDefaultBalance ?? 5),
          emergencyUsed: 0,
          emergencyRemaining: Number(defaults.emergencyDefaultBalance ?? 5),
        },
      });
    }

    const balance = await ensureEmployeeLeaveBalance(employee.id);

    return res.json({
      balances: {
        annual: Number(balance?.annual_balance ?? defaults.annualDefaultBalance ?? 30),
        annualUsed: Number(balance?.annual_used ?? 0),
        annualRemaining:
          Number(balance?.annual_balance ?? defaults.annualDefaultBalance ?? 30) -
          Number(balance?.annual_used ?? 0),

        sick: Number(balance?.sick_balance ?? defaults.sickDefaultBalance ?? 15),
        sickUsed: Number(balance?.sick_used ?? 0),
        sickRemaining:
          Number(balance?.sick_balance ?? defaults.sickDefaultBalance ?? 15) -
          Number(balance?.sick_used ?? 0),

        emergency: Number(balance?.emergency_balance ?? defaults.emergencyDefaultBalance ?? 5),
        emergencyUsed: Number(balance?.emergency_used ?? 0),
        emergencyRemaining:
          Number(balance?.emergency_balance ?? defaults.emergencyDefaultBalance ?? 5) -
          Number(balance?.emergency_used ?? 0),
      },
      employee: {
        id: employee.id,
        gasId: employee.gas_id,
        name: employee.full_name,
      },
    });
  } catch (error) {
    console.error("Leave balances error:", error);
    return res.status(500).json({ message: "Failed to load balances" });
  }
});

router.get("/balances/manage", async (req, res) => {
  try {
    if (!canManageLeaveBalances(req.user)) {
      return res
        .status(403)
        .json({ message: "You do not have permission to manage leave balances" });
    }

    const employeeId = String(req.query.employeeId || "").trim();
    const gasId = String(req.query.gasId || "").trim();

    const employee = await resolveEmployee({
      employeeId: employeeId || null,
      employeeGasId: gasId || null,
      user: req.user,
    });

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const defaults = await getSystemLeaveDefaults();
    const balance = await ensureEmployeeLeaveBalance(employee.id);

    return res.json({
      employee: {
        id: employee.id,
        gasId: employee.gas_id,
        name: employee.full_name,
      },
      balances: {
        annual: Number(balance?.annual_balance ?? defaults.annualDefaultBalance ?? 30),
        annualUsed: Number(balance?.annual_used ?? 0),
        annualRemaining:
          Number(balance?.annual_balance ?? defaults.annualDefaultBalance ?? 30) -
          Number(balance?.annual_used ?? 0),

        sick: Number(balance?.sick_balance ?? defaults.sickDefaultBalance ?? 15),
        sickUsed: Number(balance?.sick_used ?? 0),
        sickRemaining:
          Number(balance?.sick_balance ?? defaults.sickDefaultBalance ?? 15) -
          Number(balance?.sick_used ?? 0),

        emergency: Number(
          balance?.emergency_balance ?? defaults.emergencyDefaultBalance ?? 5
        ),
        emergencyUsed: Number(balance?.emergency_used ?? 0),
        emergencyRemaining:
          Number(balance?.emergency_balance ?? defaults.emergencyDefaultBalance ?? 5) -
          Number(balance?.emergency_used ?? 0),
      },
    });
  } catch (error) {
    console.error("Manage leave balances error:", error);
    return res
      .status(500)
      .json({ message: "Failed to load employee leave balances" });
  }
});

router.put("/balances/manage", async (req, res) => {
  try {
    if (!canManageLeaveBalances(req.user)) {
      return res
        .status(403)
        .json({ message: "You do not have permission to manage leave balances" });
    }

    const employeeId = String(req.body?.employeeId || req.query?.employeeId || "").trim();
    const gasId = String(req.body?.gasId || req.query?.gasId || "").trim();

    const employee = await resolveEmployee({
      employeeId: employeeId || null,
      employeeGasId: gasId || null,
      user: req.user,
    });

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const annual = Number(req.body?.annual);
    const annualUsed = Number(req.body?.annualUsed);
    const sick = Number(req.body?.sick);
    const sickUsed = Number(req.body?.sickUsed);
    const emergency = Number(req.body?.emergency);
    const emergencyUsed = Number(req.body?.emergencyUsed);

    const values = [annual, annualUsed, sick, sickUsed, emergency, emergencyUsed];

    if (values.some((value) => Number.isNaN(value) || value < 0)) {
      return res.status(400).json({
        message: "All leave balance values must be valid non-negative numbers",
      });
    }

    if (annualUsed > annual) {
      return res
        .status(400)
        .json({ message: "Annual used cannot be greater than annual balance" });
    }

    if (sickUsed > sick) {
      return res
        .status(400)
        .json({ message: "Sick used cannot be greater than sick balance" });
    }

    if (emergencyUsed > emergency) {
      return res.status(400).json({
        message: "Emergency used cannot be greater than emergency balance",
      });
    }

    await ensureEmployeeLeaveBalance(employee.id);

    const updated = await query(
      `
      UPDATE leave_balances
      SET
        annual_balance = $2,
        annual_used = $3,
        sick_balance = $4,
        sick_used = $5,
        emergency_balance = $6,
        emergency_used = $7,
        updated_at = NOW()
      WHERE employee_id = $1
      RETURNING *
      `,
      [employee.id, annual, annualUsed, sick, sickUsed, emergency, emergencyUsed]
    );

    const row = updated.rows[0];

    return res.json({
      message: "Leave balance updated successfully",
      employee: {
        id: employee.id,
        gasId: employee.gas_id,
        name: employee.full_name,
      },
      balances: {
        annual: Number(row?.annual_balance ?? 0),
        annualUsed: Number(row?.annual_used ?? 0),
        annualRemaining:
          Number(row?.annual_balance ?? 0) - Number(row?.annual_used ?? 0),

        sick: Number(row?.sick_balance ?? 0),
        sickUsed: Number(row?.sick_used ?? 0),
        sickRemaining:
          Number(row?.sick_balance ?? 0) - Number(row?.sick_used ?? 0),

        emergency: Number(row?.emergency_balance ?? 0),
        emergencyUsed: Number(row?.emergency_used ?? 0),
        emergencyRemaining:
          Number(row?.emergency_balance ?? 0) - Number(row?.emergency_used ?? 0),
      },
    });
  } catch (error) {
    console.error("Update leave balances error:", error);
    return res
      .status(500)
      .json({ message: error.message || "Failed to update leave balances" });
  }
});

router.post("/leave", uploadCloud.single("attachment"), async (req, res) => {
  try {
    await ensureLeaveReviewAttachmentColumns();

    const {
      employeeId,
      employee_id,
      employeeGasId,
      type,
      note,
      startDate,
      endDate,
      currentBank,
      newBank,
      newIban,
      requestedBy,
    } = req.body || {};

    const employee = await resolveEmployee({
      employeeId,
      employee_id,
      employeeGasId,
      username: requestedBy || req.user?.username,
      user: req.user,
    });

    if (!employee || !type) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const normalizedType = String(type).trim();
    const leavePolicy = ["annual_leave", "sick_leave", "emergency_leave"].includes(normalizedType)
      ? await getLeavePolicy(normalizedType) : null;

    const duplicate = await query(`SELECT id FROM leave_requests
      WHERE employee_id=$1 AND type=$2 AND status='pending'
      LIMIT 1`, [employee.id, normalizedType]);
    if (duplicate.rows[0]) return res.status(409).json({
      code: "DUPLICATE_PENDING_REQUEST",
      message: "لديك نفس نوع الطلب بحالة قيد الانتظار. لا يمكن إرسال طلب مكرر حتى تتم معالجة الطلب السابق.",
      duplicateRequestId: duplicate.rows[0].id,
    });

    await ensureRequestWorkflowTables();
    const defaultAssigneeResult = await query(`SELECT rm.user_id FROM request_managers rm
      LEFT JOIN request_type_managers rtm ON rtm.user_id=rm.user_id AND rtm.type_code=$1
      ORDER BY CASE WHEN rtm.user_id IS NOT NULL THEN 0 ELSE 1 END, rm.created_at ASC LIMIT 1`, [normalizedType]);
    const defaultAssigneeId = defaultAssigneeResult.rows[0]?.user_id || null;

    if (normalizedType === "salary_transfer") {
      if (!currentBank || !newBank || !newIban) {
        return res.status(400).json({
          message: "Salary transfer requires current bank, new bank, and IBAN",
        });
      }
    }

    if (
      ["annual_leave", "sick_leave", "emergency_leave"].includes(normalizedType) &&
      (!startDate || !endDate)
    ) {
      return res.status(400).json({
        message: "This request type requires start and end dates",
      });
    }

    if (leavePolicy) {
      const requestedDays = calculateRequestedDays(startDate, endDate, leavePolicy.excludeWeekends);
      if (requestedDays <= 0) {
        return res.status(400).json({ message: "The selected period contains no chargeable leave days" });
      }
      if (requestedDays > Number(leavePolicy.maxDaysPerRequest || 365)) {
        return res.status(400).json({ message: `Maximum allowed days for this request: ${leavePolicy.maxDaysPerRequest}` });
      }
      if (leavePolicy.attachmentRequired && !req.file) {
        return res.status(400).json({ message: "An attachment is required for this leave type" });
      }
    }

    if (req.file && (!leavePolicy || !leavePolicy.attachmentAllowed)) {
      return res.status(400).json({
        message: "Attachments are not allowed for this leave type",
      });
    }

    const uploadedAttachment = leavePolicy?.attachmentAllowed && req.file
      ? await uploadBufferToCloudinary(req.file, "hr-requests/request-attachments")
      : null;

    const insertResult = await query(
      `
      INSERT INTO leave_requests (
        employee_id,
        employee_name,
        employee_gas_id,
        type,
        start_date,
        end_date,
        note,
        current_bank,
        new_bank,
        new_iban,
        attachment_name,
        attachment_path,
        review_attachment_name,
        review_attachment_path,
        requested_by_id,
        assigned_to,
        assigned_at,
        status,
        created_at,
        updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,CASE WHEN $16::uuid IS NULL THEN NULL ELSE NOW() END,'pending',NOW(),NOW()
      )
      RETURNING id, employee_id, employee_name, employee_gas_id, type, requested_by_id
      `,
      [
        employee.id,
        employee.full_name || null,
        employee.gas_id || null,
        normalizedType,
        startDate || null,
        endDate || null,
        note || "",
        currentBank || null,
        newBank || null,
        newIban || null,
        req.file?.originalname || null,
        uploadedAttachment?.secure_url || uploadedAttachment?.url || null,
        null,
        null,
        req.user?.id || null,
        defaultAssigneeId,
      ]
    );

    const createdRequest = insertResult.rows[0];

    try {
      await ensureRequestWorkflowTables();
      const reviewersResult = await query(`SELECT DISTINCT u.id FROM users u
        JOIN request_managers rm ON rm.user_id=u.id
        LEFT JOIN request_type_managers rtm ON rtm.user_id=u.id
        WHERE u.is_active=TRUE AND (rtm.type_code=$1 OR NOT EXISTS(SELECT 1 FROM request_type_managers WHERE type_code=$1))
        UNION SELECT DISTINCT u.id FROM users u LEFT JOIN roles r ON r.id=u.role_id
        WHERE u.is_active=TRUE AND LOWER(COALESCE(r.name,'')) IN ('system owner','owner')`, [normalizedType]);

      const reviewerIds = (reviewersResult.rows || [])
        .map((row) => row.id)
        .filter(Boolean)
        .filter((id) => String(id) !== String(req.user?.id || ""));

      const preference = await query(`SELECT leave_request_notifications FROM system_settings ORDER BY updated_at DESC LIMIT 1`)
        .catch(() => ({ rows: [{ leave_request_notifications: true }] }));
      for (const reviewerId of preference.rows[0]?.leave_request_notifications === false ? [] : reviewerIds) {
        await createNotificationRepo(
          reviewerId,
          `New request submitted by ${employee.full_name || employee.gas_id || "Employee"} (${normalizedType})`,
          "leave_request",
          "/requests",
          {
            requestId: createdRequest.id,
            employeeId: employee.id,
            employeeName: employee.full_name || "",
            employeeGasId: employee.gas_id || "",
            type: normalizedType,
          }
        );
      }
    } catch (notificationError) {
      console.error("Reviewer notification error:", notificationError);
    }

    return res.json({ message: "Request created successfully" });
  } catch (error) {
    console.error("Create request error:", error);
    return res.status(500).json({ message: error.message || "Failed to create request" });
  }
});

router.post("/leave/:id/review", uploadCloud.array("reviewAttachments", 3), async (req, res) => {
  try {
    await ensureLeaveReviewAttachmentColumns();

    if (!(await canManageRequests(req.user))) {
      return res
        .status(403)
        .json({ message: "You do not have permission to review requests" });
    }

    const requestId = req.params.id;
    const decision = String(req.body?.decision || "").trim().toLowerCase();
    const rejectionReason = String(req.body?.rejectionReason || "").trim();

    if (!["approved", "rejected", "pending"].includes(decision)) {
      return res.status(400).json({ message: "Invalid decision" });
    }

    if (decision === "rejected" && !rejectionReason) {
      return res.status(400).json({ message: "Rejection reason is required" });
    }

    const existing = await query(
      `
      SELECT
        id,
        status,
        employee_id,
        employee_name,
        employee_gas_id,
        type,
        start_date,
        end_date,
        requested_by_id,
        review_attachment_name,
        review_attachment_path,
        review_attachments
      FROM leave_requests
      WHERE id = $1
      LIMIT 1
      `,
      [requestId]
    );

    const currentRequest = existing.rows[0];

    if (!currentRequest) {
      return res.status(404).json({ message: "Request not found" });
    }

    const reviewFiles = req.files || [];

    const reviewAttachmentRequiredTypes = [
      "payslip_request",
      "salary_certificate",
    ];

    const normalizedRequestType = String(currentRequest.type || "")
      .trim()
      .toLowerCase();

    const requiresReviewAttachment =
      reviewAttachmentRequiredTypes.includes(normalizedRequestType);

    const oldReviewAttachments = Array.isArray(currentRequest.review_attachments)
      ? currentRequest.review_attachments
      : [];

    if (
      decision === "approved" &&
      requiresReviewAttachment &&
      reviewFiles.length === 0 &&
      oldReviewAttachments.length === 0 &&
      !currentRequest.review_attachment_path
    ) {
      return res.status(400).json({
        message:
          "Payslip or salary certificate approval requires an attachment from the reviewer",
      });
    }

    if (reviewFiles.length > 3) {
      return res.status(400).json({
        message: "مسموح رفع 3 ملفات فقط",
      });
    }

    if (
      decision === "approved" &&
      String(currentRequest.status || "").toLowerCase() !== "approved"
    ) {
      await applyLeaveDeduction(currentRequest);
    }

    if (
      String(currentRequest.status || "").toLowerCase() === "approved" &&
      decision !== "approved"
    ) {
      await reverseLeaveDeduction(currentRequest);
    }

    const uploadedReviewAttachments = [];

    if (decision === "approved" && reviewFiles.length) {
      for (const file of reviewFiles) {
        const uploaded = await uploadBufferToCloudinary(
          file,
          "hr-requests/review-attachments"
        );

        uploadedReviewAttachments.push({
          name: file.originalname || "review-file",
          path: uploaded?.secure_url || uploaded?.url || null,
          mimeType: file.mimetype || null,
          size: file.size || 0,
        });
      }
    }

    const nextReviewAttachments =
      decision === "approved"
        ? uploadedReviewAttachments.length
          ? uploadedReviewAttachments
          : oldReviewAttachments
        : [];

    const firstReviewAttachment = nextReviewAttachments[0] || null;

    const nextReviewAttachmentName =
      decision === "approved"
        ? firstReviewAttachment?.name ||
          currentRequest.review_attachment_name ||
          null
        : null;

    const nextReviewAttachmentPath =
      decision === "approved"
        ? firstReviewAttachment?.path ||
          currentRequest.review_attachment_path ||
          null
        : null;

    await query(
      `
      UPDATE leave_requests
      SET
        status = $2,
        reviewer_name = CASE WHEN $2 = 'pending' THEN NULL ELSE $3 END,
        reviewed_at = CASE WHEN $2 = 'pending' THEN NULL ELSE NOW() END,
        rejection_reason = $4,
        review_attachment_name = $5,
        review_attachment_path = $6,
        review_attachments = $7::jsonb,
        updated_at = NOW()
      WHERE id = $1
      `,
      [
        requestId,
        decision,
        req.user?.fullName ||
          req.user?.full_name ||
          req.user?.name ||
          req.user?.username ||
          "Reviewer",
        decision === "pending" ? null : rejectionReason || null,
        nextReviewAttachmentName,
        nextReviewAttachmentPath,
        JSON.stringify(nextReviewAttachments),
      ]
    );

    try {
      const preference = await query(`SELECT leave_review_notifications FROM system_settings ORDER BY updated_at DESC LIMIT 1`)
        .catch(() => ({ rows: [{ leave_review_notifications: true }] }));
      if (currentRequest.requested_by_id && preference.rows[0]?.leave_review_notifications !== false) {
        await createNotificationRepo(
          currentRequest.requested_by_id,
          decision === "approved"
            ? `Your request has been approved (${currentRequest.type})`
            : decision === "rejected"
            ? `Your request has been rejected (${currentRequest.type})`
            : `Your request has been returned to pending (${currentRequest.type})`,
          "leave_review",
          "/notifications",
          {
            requestId: currentRequest.id,
            employeeId: currentRequest.employee_id,
            employeeName: currentRequest.employee_name || "",
            employeeGasId: currentRequest.employee_gas_id || "",
            type: currentRequest.type,
            decision,
            rejectionReason: decision === "rejected" ? rejectionReason : "",
            reviewComment: decision === "pending" ? "" : rejectionReason,
          }
        );
      }
    } catch (notificationError) {
      console.error("Review notification error:", notificationError);
    }

    return res.json({
      message:
        decision === "approved"
          ? "Request approved successfully"
          : decision === "rejected"
          ? "Request rejected successfully"
          : "Request returned to pending successfully",
    });
  } catch (error) {
    console.error("Review leave request error:", error);
    return res
      .status(500)
      .json({ message: error.message || "Failed to review request" });
  }
});
// =======================================================
// Monthly Annual Leave Accrual
// Adds 2.5 annual leave days automatically once per month
// =======================================================

function getCurrentAccrualMonth() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

async function ensureMonthlyAccrualTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS leave_monthly_accruals (
      id SERIAL PRIMARY KEY,
      employee_id UUID NOT NULL,
      accrual_month TEXT NOT NULL,
      amount NUMERIC(10,2) NOT NULL DEFAULT 2.5,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(employee_id, accrual_month)
    );
  `);

  await query(`
    ALTER TABLE leave_balances
    ALTER COLUMN balance TYPE NUMERIC(10,2)
    USING balance::numeric
  `);

  await query(`
    ALTER TABLE leave_balances
    ALTER COLUMN annual_balance TYPE NUMERIC(10,2)
    USING annual_balance::numeric
  `);

  await query(`
    ALTER TABLE leave_balances
    ALTER COLUMN annual_used TYPE NUMERIC(10,2)
    USING annual_used::numeric
  `);

  await query(`
    ALTER TABLE leave_balances
    ALTER COLUMN sick_balance TYPE NUMERIC(10,2)
    USING sick_balance::numeric
  `);

  await query(`
    ALTER TABLE leave_balances
    ALTER COLUMN sick_used TYPE NUMERIC(10,2)
    USING sick_used::numeric
  `);

  await query(`
    ALTER TABLE leave_balances
    ALTER COLUMN emergency_balance TYPE NUMERIC(10,2)
    USING emergency_balance::numeric
  `);

  await query(`
    ALTER TABLE leave_balances
    ALTER COLUMN emergency_used TYPE NUMERIC(10,2)
    USING emergency_used::numeric
  `);

  await query(`
    ALTER TABLE leave_balances
    ADD COLUMN IF NOT EXISTS annual_balance NUMERIC(10,2)
  `);

  await query(`
    UPDATE leave_balances
    SET annual_balance = COALESCE(annual_balance, balance, 30)
    WHERE annual_balance IS NULL
  `);
}

async function applyMonthlyAnnualAccrual(employeeId) {
  if (!employeeId) return false;

  await ensureLeaveBalancesTable();
  await ensureMonthlyAccrualTable();

  const accrualMonth = getCurrentAccrualMonth();
  const defaults = await getSystemLeaveDefaults();
  const amount = Number(defaults.monthlyAnnualAccrual ?? 2.5);

  const inserted = await query(
    `
    INSERT INTO leave_monthly_accruals (
      employee_id,
      accrual_month,
      amount,
      created_at
    )
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (employee_id, accrual_month) DO NOTHING
    RETURNING id
    `,
    [employeeId, accrualMonth, amount]
  );

  if (!inserted.rows[0]) {
    return false;
  }

  await query(
    `
    UPDATE leave_balances
SET
  annual_balance = COALESCE(annual_balance, balance, 0) + $2,
  balance = COALESCE(annual_balance, balance, 0) + $2,
  updated_at = NOW()
WHERE employee_id = $1
    `,
    [employeeId, amount]
  );

  return true;
}

async function applyMonthlyAnnualAccrualsForAllEmployees() {
  await ensureLeaveBalancesTable();
  await ensureMonthlyAccrualTable();

  const employeesResult = await query(`
    SELECT id
    FROM employees
    WHERE id IS NOT NULL
  `);

  let addedCount = 0;

  for (const employee of employeesResult.rows || []) {
    await ensureEmployeeLeaveBalance(employee.id);

    const added = await applyMonthlyAnnualAccrual(employee.id);

    if (added) {
      addedCount += 1;
    }
  }

  console.log(
    `[Monthly Annual Accrual] Applied 2.5 days to ${addedCount} employees for ${getCurrentAccrualMonth()}`
  );

  return addedCount;
}

// Run once when server starts
applyMonthlyAnnualAccrualsForAllEmployees().catch((error) => {
  console.error("[Monthly Annual Accrual] Startup error:", error);
});

// Check every 6 hours
setInterval(() => {
  applyMonthlyAnnualAccrualsForAllEmployees().catch((error) => {
    console.error("[Monthly Annual Accrual] Interval error:", error);
  });
}, 6 * 60 * 60 * 1000);

async function notifyOverdueRequests() {
  await ensureRequestWorkflowTables();
  const overdue = await query(`SELECT lr.id,lr.type,lr.assigned_to FROM leave_requests lr
    LEFT JOIN request_sla_notifications sn ON sn.request_id=lr.id::text
    WHERE lr.status='pending' AND lr.created_at < NOW()-INTERVAL '24 hours' AND sn.request_id IS NULL`);
  for (const request of overdue.rows || []) {
    const claimed = await query(`INSERT INTO request_sla_notifications(request_id) VALUES($1) ON CONFLICT DO NOTHING RETURNING request_id`, [String(request.id)]);
    if (!claimed.rows[0]) continue;
    const recipients = request.assigned_to
      ? [request.assigned_to]
      : (await query(`SELECT user_id FROM request_managers`)).rows.map((row) => row.user_id);
    for (const userId of recipients) {
      await createNotificationRepo(userId, `Request #${request.id} has been pending for more than 24 hours`, "request_sla", "/requests", { requestId: request.id });
    }
  }
}

notifyOverdueRequests().catch((error) => console.error("[Request SLA] Startup error:", error));
setInterval(() => notifyOverdueRequests().catch((error) => console.error("[Request SLA] Error:", error)), 60 * 60 * 1000);

export default router;
