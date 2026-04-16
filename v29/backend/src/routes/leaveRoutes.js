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

/**
 * Get request types
 */
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

/**
 * Get employees + leave requests
 */
router.get("/list", async (req, res) => {
  try {
    const username = req.query.username || req.user?.username || null;

    const currentEmployee = await resolveEmployee({
      username,
      user: req.user,
    });

    const employeesResult = await query(
      `
      SELECT
        id,
        gas_id,
        full_name
      FROM employees
      ORDER BY full_name ASC
      `
    );

    const employees = (employeesResult.rows || []).map((row) => ({
      id: row.id,
      gasId: row.gas_id,
      name: row.full_name || row.gas_id,
    }));

    let leaveRequestsResult;

    if (canSeeAllRequests(req.user)) {
      leaveRequestsResult = await query(
        `
        SELECT
          lr.id,
          lr.employee_id AS "employeeId",
          COALESCE(lr.employee_gas_id, e.gas_id) AS "employeeGasId",
          COALESCE(lr.employee_name, e.full_name) AS "employeeName",
          lr.type,
          lr.note,
          lr.current_bank AS "currentBank",
          lr.new_bank AS "newBank",
          lr.new_iban AS "newIban",
          lr.start_date AS "startDate",
          lr.end_date AS "endDate",
          lr.status,
          lr.rejection_reason AS "rejectionReason",
          lr.requested_by_id AS "requestedById",
          req_user.username AS "requestedBy",
          COALESCE(req_user.full_name, req_user.name, req_user.username) AS "requestedByName",
          lr.reviewer_name AS "reviewerName",
          lr.reviewed_at AS "reviewedAt",
          lr.attachment_name AS "attachmentName",
          lr.attachment_path AS "attachmentPath",
          lr.created_at AS "createdAt"
        FROM leave_requests lr
        LEFT JOIN employees e ON e.id = lr.employee_id
        LEFT JOIN users req_user ON req_user.id = lr.requested_by_id
        ORDER BY lr.created_at DESC, lr.id DESC
        `
      );
    } else if (currentEmployee?.id) {
      leaveRequestsResult = await query(
        `
        SELECT
          lr.id,
          lr.employee_id AS "employeeId",
          COALESCE(lr.employee_gas_id, e.gas_id) AS "employeeGasId",
          COALESCE(lr.employee_name, e.full_name) AS "employeeName",
          lr.type,
          lr.note,
          lr.current_bank AS "currentBank",
          lr.new_bank AS "newBank",
          lr.new_iban AS "newIban",
          lr.start_date AS "startDate",
          lr.end_date AS "endDate",
          lr.status,
          lr.rejection_reason AS "rejectionReason",
          lr.requested_by_id AS "requestedById",
          req_user.username AS "requestedBy",
          COALESCE(req_user.full_name, req_user.name, req_user.username) AS "requestedByName",
          lr.reviewer_name AS "reviewerName",
          lr.reviewed_at AS "reviewedAt",
          lr.attachment_name AS "attachmentName",
          lr.attachment_path AS "attachmentPath",
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

/**
 * Get leave balances
 */
router.get("/balances", async (req, res) => {
  try {
    const username = req.query.username || req.user?.username || null;

    const employee = await resolveEmployee({
      username,
      user: req.user,
    });

    if (!employee) {
      return res.json({
        balances: {
          annual: 30,
          sick: 15,
          emergency: 5,
        },
      });
    }

    const balanceResult = await query(
      `
      SELECT *
      FROM leave_balances
      WHERE employee_id = $1
      LIMIT 1
      `,
      [employee.id]
    );

    const balance = balanceResult.rows[0];

    return res.json({
      balances: {
        annual: balance?.annual_balance ?? balance?.balance ?? 30,
        sick: balance?.sick_balance ?? 15,
        emergency: balance?.emergency_balance ?? 5,
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

/**
 * Create new request
 */
router.post("/leave", upload.single("attachment"), async (req, res) => {
  try {
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
        requested_by_id,
        status,
        created_at,
        updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'pending',NOW(),NOW()
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
        req.user?.id || null,
      ]
    );

    const createdRequest = insertResult.rows[0];

    try {
      const reviewersResult = await query(
        `
        SELECT DISTINCT u.id
        FROM users u
        LEFT JOIN roles r ON r.id = u.role_id
        WHERE u.is_active = TRUE
          AND LOWER(COALESCE(r.name, '')) IN (
            'system owner',
            'hr manager',
            'hr'
          )
        `
      );

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

/**
 * Review request
 */
router.post("/leave/:id/review", async (req, res) => {
  try {
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
        requested_by_id
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

    await query(
      `
      UPDATE leave_requests
      SET
        status = $2,
        reviewer_name = $3,
        reviewed_at = NOW(),
        rejection_reason = $4,
        updated_at = NOW()
      WHERE id = $1
      `,
      [
        requestId,
        decision,
        req.user?.name || req.user?.username || "Reviewer",
        decision === "rejected" ? rejectionReason : null,
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
    return res.status(500).json({ message: "Failed to review request" });
  }
});

export default router;
