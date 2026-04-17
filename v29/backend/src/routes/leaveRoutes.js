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

  return permissions.includes("manage_leave_balances");
}

function asNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toSafeDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function dateOnly(value) {
  const d = toSafeDate(value);
  if (!d) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function calcRequestedDays(startDate, endDate) {
  const start = toSafeDate(startDate);
  const end = toSafeDate(endDate || startDate);

  if (!start || !end) return 0;

  const startOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());

  const diffMs = endOnly.getTime() - startOnly.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;

  return diffDays > 0 ? diffDays : 0;
}

function mapLeaveTypeToBalanceColumn(type) {
  const normalized = String(type || "").trim().toLowerCase();

  if (normalized === "annual_leave") {
    return { total: "annual_leave_total", used: "annual_leave_used" };
  }

  if (normalized === "sick_leave") {
    return { total: "sick_leave_total", used: "sick_leave_used" };
  }

  if (normalized === "emergency_leave") {
    return { total: "emergency_leave_total", used: "emergency_leave_used" };
  }

  return null;
}

async function ensureLeaveBalanceTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS leave_balances (
      employee_id UUID PRIMARY KEY REFERENCES employees(id) ON DELETE CASCADE,
      annual_leave_total NUMERIC NOT NULL DEFAULT 30,
      annual_leave_used NUMERIC NOT NULL DEFAULT 0,
      sick_leave_total NUMERIC NOT NULL DEFAULT 15,
      sick_leave_used NUMERIC NOT NULL DEFAULT 0,
      emergency_leave_total NUMERIC NOT NULL DEFAULT 5,
      emergency_leave_used NUMERIC NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
}

async function ensureLeaveRequestsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS leave_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
      employee_gas_id TEXT,
      type TEXT NOT NULL,
      start_date DATE,
      end_date DATE,
      note TEXT,
      attachment_name TEXT,
      attachment_path TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      rejection_reason TEXT,
      requested_by TEXT,
      requested_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
      reviewed_by TEXT,
      reviewed_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
      reviewed_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
}

async function ensureSystemSettingsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
}

async function ensureNotificationsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'general',
      is_read BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
}

async function ensureRequestTypesTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS request_types (
      code TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      requires_attachment BOOLEAN NOT NULL DEFAULT FALSE,
      requires_date_range BOOLEAN NOT NULL DEFAULT TRUE,
      requires_bank_fields BOOLEAN NOT NULL DEFAULT FALSE,
      sort_order INT NOT NULL DEFAULT 0
    );
  `);

  await query(`
    INSERT INTO request_types (
      code,
      label,
      requires_attachment,
      requires_date_range,
      requires_bank_fields,
      sort_order
    )
    VALUES
      ('annual_leave', 'إجازة سنوية', FALSE, TRUE, FALSE, 1),
      ('sick_leave', 'إجازة مرضية', TRUE, TRUE, FALSE, 2),
      ('emergency_leave', 'إجازة اضطرارية', FALSE, TRUE, FALSE, 3),
      ('salary_transfer', 'تحويل راتب', TRUE, FALSE, TRUE, 4),
      ('payslip_request', 'طلب تعريف بالراتب / Payslip', FALSE, FALSE, FALSE, 5)
    ON CONFLICT (code) DO UPDATE SET
      label = EXCLUDED.label,
      requires_attachment = EXCLUDED.requires_attachment,
      requires_date_range = EXCLUDED.requires_date_range,
      requires_bank_fields = EXCLUDED.requires_bank_fields,
      sort_order = EXCLUDED.sort_order;
  `);
}

async function ensureLeaveSchema() {
  await ensureLeaveBalanceTable();
  await ensureLeaveRequestsTable();
  await ensureSystemSettingsTable();
  await ensureNotificationsTable();
  await ensureRequestTypesTable();
}

async function getEmployeeByUser(user) {
  if (!user?.id && !user?.employeeId && !user?.gasId) {
    return null;
  }

  const result = await query(
    `
    SELECT
      e.id,
      e.name,
      e.gas_id,
      e.job_title,
      e.project_id,
      e.package_id
    FROM employees e
    LEFT JOIN users u ON u.employee_id = e.id
    WHERE
      u.id = $1
      OR e.id = $2
      OR e.gas_id = $3
    LIMIT 1
    `,
    [user?.id || null, user?.employeeId || null, user?.gasId || null]
  );

  return result.rows[0] || null;
}

async function getEmployeeByIds({ employeeId, employeeGasId }) {
  const result = await query(
    `
    SELECT
      id,
      name,
      gas_id,
      job_title,
      project_id,
      package_id
    FROM employees
    WHERE
      id = $1
      OR gas_id = $2
    ORDER BY CASE WHEN id = $1 THEN 0 ELSE 1 END
    LIMIT 1
    `,
    [employeeId || null, employeeGasId || null]
  );

  return result.rows[0] || null;
}

async function getReviewersUsers() {
  const result = await query(
    `
    SELECT
      u.id,
      u.username,
      COALESCE(r.name, r.code, u.role) AS role_name
    FROM users u
    LEFT JOIN roles r ON r.id = u.role_id
    WHERE u.is_active = TRUE
    `
  );

  return result.rows.filter((row) => canReviewRequests({ roleName: row.role_name }));
}

async function ensureLeaveBalanceRow(employeeId) {
  await ensureLeaveBalanceTable();

  await query(
    `
    INSERT INTO leave_balances (employee_id)
    VALUES ($1)
    ON CONFLICT (employee_id) DO NOTHING
    `,
    [employeeId]
  );
}

async function getDefaultLeaveBalances() {
  await ensureSystemSettingsTable();

  const result = await query(
    `
    SELECT value_json
    FROM system_settings
    WHERE key = 'default_leave_balances'
    LIMIT 1
    `
  );

  const value = result.rows[0]?.value_json || {};

  return {
    annual: asNumber(value.annual, 30),
    sick: asNumber(value.sick, 15),
    emergency: asNumber(value.emergency, 5),
  };
}

async function applyDefaultBalancesIfNeeded(employeeId) {
  await ensureLeaveBalanceRow(employeeId);

  const defaults = await getDefaultLeaveBalances();

  await query(
    `
    UPDATE leave_balances
    SET
      annual_leave_total = COALESCE(NULLIF(annual_leave_total, 0), $2),
      sick_leave_total = COALESCE(NULLIF(sick_leave_total, 0), $3),
      emergency_leave_total = COALESCE(NULLIF(emergency_leave_total, 0), $4),
      updated_at = NOW()
    WHERE employee_id = $1
    `,
    [employeeId, defaults.annual, defaults.sick, defaults.emergency]
  );
}

async function getLeaveBalances(employeeId) {
  await ensureLeaveBalanceRow(employeeId);
  await applyDefaultBalancesIfNeeded(employeeId);

  const result = await query(
    `
    SELECT
      annual_leave_total,
      annual_leave_used,
      sick_leave_total,
      sick_leave_used,
      emergency_leave_total,
      emergency_leave_used
    FROM leave_balances
    WHERE employee_id = $1
    LIMIT 1
    `,
    [employeeId]
  );

  const row = result.rows[0] || {};

  const annual = asNumber(row.annual_leave_total, 30);
  const annualUsed = asNumber(row.annual_leave_used, 0);
  const sick = asNumber(row.sick_leave_total, 15);
  const sickUsed = asNumber(row.sick_leave_used, 0);
  const emergency = asNumber(row.emergency_leave_total, 5);
  const emergencyUsed = asNumber(row.emergency_leave_used, 0);

  return {
    annual,
    annualUsed,
    annualRemaining: Math.max(annual - annualUsed, 0),
    sick,
    sickUsed,
    sickRemaining: Math.max(sick - sickUsed, 0),
    emergency,
    emergencyUsed,
    emergencyRemaining: Math.max(emergency - emergencyUsed, 0),
  };
}

async function updateUsedBalance(employeeId, type, daysToAdd) {
  const columns = mapLeaveTypeToBalanceColumn(type);
  if (!columns) return;

  await ensureLeaveBalanceRow(employeeId);

  await query(
    `
    UPDATE leave_balances
    SET
      ${columns.used} = GREATEST(0, COALESCE(${columns.used}, 0) + $2),
      updated_at = NOW()
    WHERE employee_id = $1
    `,
    [employeeId, asNumber(daysToAdd, 0)]
  );
}

async function createNotification({ userId, title, body, type = "general" }) {
  if (!userId) return;

  await ensureNotificationsTable();

  await query(
    `
    INSERT INTO notifications (user_id, title, body, type)
    VALUES ($1, $2, $3, $4)
    `,
    [userId, title, body, type]
  );
}

async function getRequestTypes() {
  await ensureRequestTypesTable();

  const result = await query(
    `
    SELECT
      code,
      label,
      requires_attachment AS "requiresAttachment",
      requires_date_range AS "requiresDateRange",
      requires_bank_fields AS "requiresBankFields"
    FROM request_types
    ORDER BY sort_order ASC, label ASC
    `
  );

  return result.rows;
}

async function getScopedLeaveRequests(currentUser) {
  await ensureLeaveRequestsTable();

  if (canSeeAllRequests(currentUser)) {
    const result = await query(
      `
      SELECT
        lr.id,
        lr.employee_id AS "employeeId",
        lr.employee_gas_id AS "employeeGasId",
        lr.type,
        lr.start_date AS "startDate",
        lr.end_date AS "endDate",
        lr.note,
        lr.attachment_name AS "attachmentName",
        lr.attachment_path AS "attachmentPath",
        lr.status,
        lr.rejection_reason AS "rejectionReason",
        lr.requested_by AS "requestedBy",
        lr.requested_by_id AS "requestedById",
        lr.reviewed_by AS "reviewedBy",
        lr.reviewed_by_id AS "reviewedById",
        lr.reviewed_at AS "reviewedAt",
        lr.created_at AS "createdAt",
        lr.updated_at AS "updatedAt",
        e.name AS "employeeName"
      FROM leave_requests lr
      LEFT JOIN employees e ON e.id = lr.employee_id
      ORDER BY lr.created_at DESC, lr.id DESC
      `
    );

    return result.rows;
  }

  const employee = await getEmployeeByUser(currentUser);

  const result = await query(
    `
    SELECT
      lr.id,
      lr.employee_id AS "employeeId",
      lr.employee_gas_id AS "employeeGasId",
      lr.type,
      lr.start_date AS "startDate",
      lr.end_date AS "endDate",
      lr.note,
      lr.attachment_name AS "attachmentName",
      lr.attachment_path AS "attachmentPath",
      lr.status,
      lr.rejection_reason AS "rejectionReason",
      lr.requested_by AS "requestedBy",
      lr.requested_by_id AS "requestedById",
      lr.reviewed_by AS "reviewedBy",
      lr.reviewed_by_id AS "reviewedById",
      lr.reviewed_at AS "reviewedAt",
      lr.created_at AS "createdAt",
      lr.updated_at AS "updatedAt",
      e.name AS "employeeName"
    FROM leave_requests lr
    LEFT JOIN employees e ON e.id = lr.employee_id
    WHERE
      lr.requested_by_id = $1
      OR lr.employee_id = $2
      OR lr.employee_gas_id = $3
    ORDER BY lr.created_at DESC, lr.id DESC
    `,
    [currentUser?.id || null, employee?.id || null, employee?.gas_id || currentUser?.gasId || null]
  );

  return result.rows;
}

async function getScopedEmployees(currentUser) {
  if (!canSeeAllRequests(currentUser)) {
    const employee = await getEmployeeByUser(currentUser);
    return employee
      ? [
          {
            id: employee.id,
            name: employee.name,
            gasId: employee.gas_id,
          },
        ]
      : [];
  }

  const result = await query(
    `
    SELECT
      id,
      name,
      gas_id AS "gasId"
    FROM employees
    ORDER BY name ASC NULLS LAST, gas_id ASC NULLS LAST
    `
  );

  return result.rows;
}

router.get("/types", async (_req, res) => {
  try {
    await ensureLeaveSchema();
    const types = await getRequestTypes();
    return res.json({ types });
  } catch (error) {
    console.error("Request types error:", error);
    return res.status(500).json({ message: "Failed to load request types" });
  }
});

router.get("/list", async (req, res) => {
  try {
    await ensureLeaveSchema();

    const [leaveRequests, employees] = await Promise.all([
      getScopedLeaveRequests(req.user),
      getScopedEmployees(req.user),
    ]);

    return res.json({
      leaveRequests,
      attendanceAdjustments: [],
      employees,
    });
  } catch (error) {
    console.error("Leave list error:", error);
    return res.status(500).json({ message: "Failed to load requests list" });
  }
});

router.get("/balances", async (req, res) => {
  try {
    await ensureLeaveSchema();

    const employee = await getEmployeeByUser(req.user);

    if (!employee?.id) {
      return res.json({
        balances: {
          annual: 30,
          annualUsed: 0,
          annualRemaining: 30,
          sick: 15,
          sickUsed: 0,
          sickRemaining: 15,
          emergency: 5,
          emergencyUsed: 0,
          emergencyRemaining: 5,
        },
      });
    }

    const balances = await getLeaveBalances(employee.id);
    return res.json({ balances });
  } catch (error) {
    console.error("Leave balances error:", error);
    return res.status(500).json({ message: "Failed to load balances" });
  }
});

router.post("/leave", upload.single("attachment"), async (req, res) => {
  try {
    await ensureLeaveSchema();

    const {
      employeeId,
      employeeGasId,
      type,
      startDate,
      endDate,
      note,
      requestedBy,
      currentBank,
      newBank,
      newIban,
    } = req.body;

    if (!type) {
      return res.status(400).json({ message: "نوع الطلب مطلوب" });
    }

    const requestTypes = await getRequestTypes();
    const selectedType = requestTypes.find((item) => item.code === type);

    if (!selectedType) {
      return res.status(400).json({ message: "نوع الطلب غير معروف" });
    }

    const employee = await getEmployeeByIds({
      employeeId,
      employeeGasId,
    });

    if (!employee?.id) {
      return res.status(400).json({ message: "تعذر تحديد الموظف" });
    }

    if (!canSeeAllRequests(req.user)) {
      const currentEmployee = await getEmployeeByUser(req.user);
      const allowed =
        String(currentEmployee?.id || "") === String(employee.id || "") ||
        String(currentEmployee?.gas_id || req.user?.gasId || "") ===
          String(employee.gas_id || "");

      if (!allowed) {
        return res.status(403).json({ message: "لا يمكنك إنشاء طلب لهذا الموظف" });
      }
    }

    if (selectedType.requiresDateRange) {
      if (!startDate || !endDate) {
        return res
          .status(400)
          .json({ message: "تاريخ البداية والنهاية مطلوبان لهذا النوع" });
      }

      const requestedDays = calcRequestedDays(startDate, endDate);

      if (requestedDays <= 0) {
        return res.status(400).json({ message: "عدد الأيام غير صحيح" });
      }

      const balanceColumns = mapLeaveTypeToBalanceColumn(type);

      if (balanceColumns) {
        const balances = await getLeaveBalances(employee.id);

        if (
          (type === "annual_leave" && requestedDays > balances.annualRemaining) ||
          (type === "sick_leave" && requestedDays > balances.sickRemaining) ||
          (type === "emergency_leave" &&
            requestedDays > balances.emergencyRemaining)
        ) {
          return res.status(400).json({
            message: "رصيد الإجازة غير كافٍ لهذا الطلب",
          });
        }
      }
    }

    if (selectedType.requiresAttachment && !req.file) {
      return res
        .status(400)
        .json({ message: "المرفق مطلوب لهذا النوع من الطلبات" });
    }

    if (selectedType.requiresBankFields) {
      if (!currentBank || !newBank || !newIban) {
        return res.status(400).json({
          message: "بيانات تحويل الراتب مطلوبة",
        });
      }
    }

    const bankNote =
      selectedType.requiresBankFields
        ? `\nCurrent Bank: ${currentBank}\nNew Bank: ${newBank}\nNew IBAN: ${newIban}`
        : "";

    const attachmentName = req.file?.originalname || null;
    const attachmentPath = req.file?.filename || null;

    const inserted = await query(
      `
      INSERT INTO leave_requests (
        employee_id,
        employee_gas_id,
        type,
        start_date,
        end_date,
        note,
        attachment_name,
        attachment_path,
        status,
        requested_by,
        requested_by_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9, $10)
      RETURNING
        id,
        employee_id AS "employeeId",
        employee_gas_id AS "employeeGasId",
        type,
        start_date AS "startDate",
        end_date AS "endDate",
        note,
        attachment_name AS "attachmentName",
        attachment_path AS "attachmentPath",
        status,
        requested_by AS "requestedBy",
        requested_by_id AS "requestedById",
        created_at AS "createdAt"
      `,
      [
        employee.id,
        employee.gas_id || employeeGasId || null,
        type,
        selectedType.requiresDateRange ? dateOnly(startDate) : null,
        selectedType.requiresDateRange ? dateOnly(endDate) : null,
        `${note || ""}${bankNote}`,
        attachmentName,
        attachmentPath,
        requestedBy || req.user?.username || "system",
        req.user?.id || null,
      ]
    );

    const savedRequest = inserted.rows[0];

    try {
      const notificationRepo = createNotificationRepo({ query });

      const reviewers = await getReviewersUsers();

      await Promise.all(
        reviewers.map((reviewer) =>
          notificationRepo.createNotification({
            userId: reviewer.id,
            title: "طلب جديد يحتاج مراجعة",
            body: `${employee.name || employee.gas_id || "Employee"} أرسل طلب ${selectedType.label}`,
            type: "request_review",
          })
        )
      );
    } catch (notifyError) {
      console.error("Create request notification error:", notifyError);
    }

    return res.status(201).json({
      message: "تم إرسال الطلب بنجاح",
      request: savedRequest,
    });
  } catch (error) {
    console.error("Create leave request error:", error);
    return res.status(500).json({ message: "Failed to create request" });
  }
});

router.post(
  "/leave/:id/review",
  upload.single("reviewAttachment"),
  async (req, res) => {
    try {
      await ensureLeaveSchema();

      if (!canReviewRequests(req.user)) {
        return res
          .status(403)
          .json({ message: "ليس لديك صلاحية مراجعة الطلبات" });
      }

      const { decision, rejectionReason } = req.body;

      const normalizedDecision = String(decision || "").trim().toLowerCase();

      if (!["approved", "rejected"].includes(normalizedDecision)) {
        return res.status(400).json({ message: "قرار المراجعة غير صحيح" });
      }

      const existingResult = await query(
        `
        SELECT
          lr.id,
          lr.employee_id,
          lr.employee_gas_id,
          lr.type,
          lr.status,
          lr.attachment_name,
          lr.attachment_path,
          e.name AS employee_name,
          u.id AS owner_user_id
        FROM leave_requests lr
        LEFT JOIN employees e ON e.id = lr.employee_id
        LEFT JOIN users u ON u.employee_id = lr.employee_id
        WHERE lr.id = $1
        LIMIT 1
        `,
        [req.params.id]
      );

      const existing = existingResult.rows[0];

      if (!existing) {
        if (req.file?.path) {
          fs.unlink(req.file.path, () => {});
        }
        return res.status(404).json({ message: "الطلب غير موجود" });
      }

      if (String(existing.status || "").toLowerCase() !== "pending") {
        if (req.file?.path) {
          fs.unlink(req.file.path, () => {});
        }
        return res.status(400).json({ message: "تمت مراجعة الطلب مسبقًا" });
      }

      const isPayslipRequest =
        String(existing.type || "").trim().toLowerCase() === "payslip_request";

      const hasExistingAttachment =
        Boolean(existing.attachment_path) && Boolean(existing.attachment_name);

      if (
        normalizedDecision === "approved" &&
        isPayslipRequest &&
        !req.file &&
        !hasExistingAttachment
      ) {
        return res.status(400).json({
          message:
            "لا يمكن اعتماد طلب تعريف بالراتب بدون رفع مرفق الباي سليب",
        });
      }

      if (normalizedDecision === "rejected" && !String(rejectionReason || "").trim()) {
        if (req.file?.path) {
          fs.unlink(req.file.path, () => {});
        }
        return res.status(400).json({ message: "سبب الرفض مطلوب" });
      }

      let nextAttachmentName = existing.attachment_name || null;
      let nextAttachmentPath = existing.attachment_path || null;

      if (normalizedDecision === "approved" && req.file) {
        if (existing.attachment_path) {
          const oldFile = path.resolve(uploadsDir, path.basename(existing.attachment_path));
          if (fs.existsSync(oldFile)) {
            try {
              fs.unlinkSync(oldFile);
            } catch (unlinkError) {
              console.error("Delete old attachment error:", unlinkError);
            }
          }
        }

        nextAttachmentName = req.file.originalname || nextAttachmentName;
        nextAttachmentPath = req.file.filename || nextAttachmentPath;
      }

      const updated = await query(
        `
        UPDATE leave_requests
        SET
          status = $2,
          rejection_reason = $3,
          reviewed_by = $4,
          reviewed_by_id = $5,
          reviewed_at = NOW(),
          attachment_name = $6,
          attachment_path = $7,
          updated_at = NOW()
        WHERE id = $1
        RETURNING
          id,
          employee_id AS "employeeId",
          employee_gas_id AS "employeeGasId",
          type,
          start_date AS "startDate",
          end_date AS "endDate",
          note,
          attachment_name AS "attachmentName",
          attachment_path AS "attachmentPath",
          status,
          rejection_reason AS "rejectionReason",
          requested_by AS "requestedBy",
          requested_by_id AS "requestedById",
          reviewed_by AS "reviewedBy",
          reviewed_by_id AS "reviewedById",
          reviewed_at AS "reviewedAt",
          updated_at AS "updatedAt"
        `,
        [
          req.params.id,
          normalizedDecision,
          normalizedDecision === "rejected"
            ? String(rejectionReason || "").trim()
            : null,
          req.user?.username || "reviewer",
          req.user?.id || null,
          nextAttachmentName,
          nextAttachmentPath,
        ]
      );

      const saved = updated.rows[0];

      if (normalizedDecision === "approved") {
        const requestedDays = calcRequestedDays(saved.startDate, saved.endDate);
        const balanceColumns = mapLeaveTypeToBalanceColumn(saved.type);

        if (balanceColumns && requestedDays > 0 && saved.employeeId) {
          await updateUsedBalance(saved.employeeId, saved.type, requestedDays);
        }
      }

      try {
        const notificationRepo = createNotificationRepo({ query });

        if (existing.owner_user_id) {
          await notificationRepo.createNotification({
            userId: existing.owner_user_id,
            title:
              normalizedDecision === "approved"
                ? "تمت الموافقة على الطلب"
                : "تم رفض الطلب",
            body:
              normalizedDecision === "approved"
                ? `تمت الموافقة على طلب ${existing.employee_name || existing.employee_gas_id || "Employee"}`
                : `تم رفض طلب ${existing.employee_name || existing.employee_gas_id || "Employee"}: ${String(rejectionReason || "").trim()}`,
            type: "request_result",
          });
        }
      } catch (notifyError) {
        console.error("Review request notification error:", notifyError);
      }

      return res.json({
        message:
          normalizedDecision === "approved"
            ? "تمت الموافقة على الطلب"
            : "تم رفض الطلب",
        request: saved,
      });
    } catch (error) {
      console.error("Review leave request error:", error);
      return res.status(500).json({ message: "Failed to review request" });
    }
  }
);

router.post("/balances/:employeeId", async (req, res) => {
  try {
    await ensureLeaveSchema();

    if (!canManageLeaveBalances(req.user)) {
      return res
        .status(403)
        .json({ message: "ليس لديك صلاحية تعديل الأرصدة" });
    }

    const { annual, sick, emergency } = req.body || {};

    await ensureLeaveBalanceRow(req.params.employeeId);

    await query(
      `
      UPDATE leave_balances
      SET
        annual_leave_total = $2,
        sick_leave_total = $3,
        emergency_leave_total = $4,
        updated_at = NOW()
      WHERE employee_id = $1
      `,
      [
        req.params.employeeId,
        asNumber(annual, 30),
        asNumber(sick, 15),
        asNumber(emergency, 5),
      ]
    );

    const balances = await getLeaveBalances(req.params.employeeId);

    return res.json({
      message: "تم تحديث الأرصدة بنجاح",
      balances,
    });
  } catch (error) {
    console.error("Update leave balances error:", error);
    return res.status(500).json({ message: "Failed to update balances" });
  }
});

export default router;
