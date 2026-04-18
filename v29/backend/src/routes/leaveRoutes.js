import express from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import { fileURLToPath } from "url";
import { query } from "../data/index.js";
import { requireAuth } from "../middleware_auth.js";
import { createNotificationRepo } from "../data/leaveNotificationRepository.js";

const router = express.Router();

router.use(requireAuth);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, "../uploads/requests");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

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

function normalizeRole(value) {
  return String(value || "").trim().toLowerCase();
}

function canSeeAllRequests(user) {
  const role = normalizeRole(user?.roleName || user?.role || user?.roleCode);
  return [
    "system owner",
    "owner",
    "system_owner",
    "hr manager",
    "hr_manager",
    "hr",
    "cm",
    "project manager",
    "project_manager",
  ].includes(role);
}

function canReviewRequests(user) {
  return canSeeAllRequests(user);
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
    FROM system_settings
    LIMIT 1
  `);

  return result.rows[0] || {
    annualDefaultBalance: 30,
    sickDefaultBalance: 15,
    emergencyDefaultBalance: 5,
  };
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

function calculateRequestedDays(startDate, endDate) {
  if (!startDate) return 1;

  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date(startDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 1;
  }

  const startOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());

  const diffMs = endOnly.getTime() - startOnly.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;

  return diffDays > 0 ? diffDays : 1;
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

  const days = calculateRequestedDays(currentRequest.start_date, currentRequest.end_date);

  if (leaveType === "annual_leave") {
    const remaining = Number(balance.annual_balance || 0) - Number(balance.annual_used || 0);
    if (remaining < days) {
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
    const remaining = Number(balance.emergency_balance || 0) - Number(balance.emergency_used || 0);
    if (remaining < days) {
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
    if (remaining < days) {
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
    return res.json({
      types: [
        {
          code: "annual_leave",
          label: "إجازة سنوية",
          requiresAttachment: false,
          requiresDateRange: true,
          requiresBankFields: false,
        },
        {
          code: "sick_leave",
          label: "إجازة مرضية",
          requiresAttachment: true,
          requiresDateRange: true,
          requiresBankFields: false,
        },
        {
          code: "emergency_leave",
          label: "إجازة اضطرارية",
          requiresAttachment: false,
          requiresDateRange: true,
          requiresBankFields: false,
        },
        {
          code: "salary_transfer",
          label: "تحويل راتب",
          requiresAttachment: true,
          requiresDateRange: false,
          requiresBankFields: true,
        },
        {
          code: "payslip_request",
          label: "طلب تعريف بالراتب / Payslip",
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

router.get("/list", async (req, res) => {
  try {
    await ensureLeaveReviewAttachmentColumns();

    const username = req.query.username || req.user?.username || null;

    const currentEmployee = await resolveEmployee({
      username,
      user: req.user,
    });

    const employeesResult = await query(`
      SELECT
        id,
        gas_id,
        full_name
      FROM employees
      ORDER BY full_name ASC
    `);

    const employees = (employeesResult.rows || []).map((row) => ({
      id: row.id,
      gasId: row.gas_id,
      name: row.full_name || row.gas_id,
    }));

    let leaveRequestsResult;

    if (canSeeAllRequests(req.user)) {
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
          lr.created_at AS "createdAt"
        FROM leave_requests lr
        LEFT JOIN employees e ON e.id = lr.employee_id
        LEFT JOIN users req_user ON req_user.id = lr.requested_by_id
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
          lr.created_at AS "createdAt"
        FROM leave_requests lr
        LEFT JOIN employees e ON e.id = lr.employee_id
        LEFT JOIN users req_user ON req_user.id = lr.requested_by_id
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
      return res.status(403).json({ message: "You do not have permission to manage leave balances" });
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

        emergency: Number(balance?.emergency_balance ?? defaults.emergencyDefaultBalance ?? 5),
        emergencyUsed: Number(balance?.emergency_used ?? 0),
        emergencyRemaining:
          Number(balance?.emergency_balance ?? defaults.emergencyDefaultBalance ?? 5) -
          Number(balance?.emergency_used ?? 0),
      },
    });
  } catch (error) {
    console.error("Manage leave balances error:", error);
    return res.status(500).json({ message: "Failed to load employee leave balances" });
  }
});

router.put("/balances/manage", async (req, res) => {
  try {
    if (!canManageLeaveBalances(req.user)) {
      return res.status(403).json({ message: "You do not have permission to manage leave balances" });
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
      return res.status(400).json({ message: "All leave balance values must be valid non-negative numbers" });
    }

    if (annualUsed > annual) {
      return res.status(400).json({ message: "Annual used cannot be greater than annual balance" });
    }

    if (sickUsed > sick) {
      return res.status(400).json({ message: "Sick used cannot be greater than sick balance" });
    }

    if (emergencyUsed > emergency) {
      return res.status(400).json({ message: "Emergency used cannot be greater than emergency balance" });
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
      [
        employee.id,
        annual,
        annualUsed,
        sick,
        sickUsed,
        emergency,
        emergencyUsed,
      ]
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
        annualRemaining: Number(row?.annual_balance ?? 0) - Number(row?.annual_used ?? 0),

        sick: Number(row?.sick_balance ?? 0),
        sickUsed: Number(row?.sick_used ?? 0),
        sickRemaining: Number(row?.sick_balance ?? 0) - Number(row?.sick_used ?? 0),

        emergency: Number(row?.emergency_balance ?? 0),
        emergencyUsed: Number(row?.emergency_used ?? 0),
        emergencyRemaining: Number(row?.emergency_balance ?? 0) - Number(row?.emergency_used ?? 0),
      },
    });
  } catch (error) {
    console.error("Update leave balances error:", error);
    return res.status(500).json({ message: error.message || "Failed to update leave balances" });
  }
});

router.post("/leave", upload.single("attachment"), async (req, res) => {
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

    if (["sick_leave", "salary_transfer"].includes(normalizedType) && !req.file) {
      return res.status(400).json({
        message: "Attachment is required for this request type",
      });
    }

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
        status,
        created_at,
        updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'pending',NOW(),NOW()
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
        req.file ? `/uploads/requests/${req.file.filename}` : null,
        null,
        null,
        req.user?.id || null,
      ]
    );

    const createdRequest = insertResult.rows[0];

    try {
      const reviewersResult = await query(`
        SELECT DISTINCT u.id
        FROM users u
        LEFT JOIN roles r ON r.id = u.role_id
        WHERE u.is_active = TRUE
          AND LOWER(COALESCE(r.name, '')) IN (
            'system owner',
            'hr manager',
            'hr'
          )
      `);

      const reviewerIds = (reviewersResult.rows || [])
        .map((row) => row.id)
        .filter(Boolean)
        .filter((id) => String(id) !== String(req.user?.id || ""));

      for (const reviewerId of reviewerIds) {
        await createNotificationRepo(
          reviewerId,
          `New request submitted by ${employee.full_name || employee.gas_id || "Employee"} (${normalizedType})`,
          "leave_request",
          "/notifications",
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
    return res.status(500).json({ message: "Failed to create request" });
  }
});

router.post("/leave/:id/review", upload.single("reviewAttachment"), async (req, res) => {
  try {
    await ensureLeaveReviewAttachmentColumns();

    if (!canReviewRequests(req.user)) {
      return res.status(403).json({ message: "You do not have permission to review requests" });
    }

    const requestId = req.params.id;
    const decision = String(req.body?.decision || "").trim().toLowerCase();
    const rejectionReason = String(req.body?.rejectionReason || "").trim();

    if (!["approved", "rejected"].includes(decision)) {
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
        review_attachment_path
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

    const isPayslipRequest =
      String(currentRequest.type || "").trim().toLowerCase() === "payslip_request";

    if (decision === "approved" && isPayslipRequest && !req.file && !currentRequest.review_attachment_path) {
      return res.status(400).json({
        message: "Payslip approval requires an attachment from the reviewer",
      });
    }

    if (decision === "approved" && String(currentRequest.status || "").toLowerCase() !== "approved") {
      await applyLeaveDeduction(currentRequest);
    }

    const nextReviewAttachmentName =
      decision === "approved"
        ? (req.file?.originalname || currentRequest.review_attachment_name || null)
        : null;

    const nextReviewAttachmentPath =
      decision === "approved"
        ? (req.file ? `/uploads/requests/${req.file.filename}` : currentRequest.review_attachment_path || null)
        : null;

    await query(
      `
      UPDATE leave_requests
      SET
        status = $2,
        reviewer_name = $3,
        reviewed_at = NOW(),
        rejection_reason = $4,
        review_attachment_name = $5,
        review_attachment_path = $6,
        updated_at = NOW()
      WHERE id = $1
      `,
      [
        requestId,
        decision,
        req.user?.name || req.user?.username || "Reviewer",
        decision === "rejected" ? rejectionReason : null,
        nextReviewAttachmentName,
        nextReviewAttachmentPath,
      ]
    );

    try {
      if (currentRequest.requested_by_id) {
        await createNotificationRepo(
          currentRequest.requested_by_id,
          decision === "approved"
            ? `Your request has been approved (${currentRequest.type})`
            : `Your request has been rejected (${currentRequest.type})`,
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
          : "Request rejected successfully",
    });
  } catch (error) {
    console.error("Review leave request error:", error);
    return res.status(500).json({ message: error.message || "Failed to review request" });
  }
});

export default router;