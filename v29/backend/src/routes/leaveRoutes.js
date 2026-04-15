import express from "express";
import { query } from "../data/index.js";
import { requireAuth } from "../middleware_auth.js";

const router = express.Router();

router.use(requireAuth);

async function resolveEmployee({ employeeId, employee_id, employeeGasId, username, user }) {
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
 * Get employees list + leave requests
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

    const elevatedRoles = ["system owner", "owner", "hr manager", "hr", "cm", "project manager"];
    const currentRole = String(
      req.user?.roleName || req.user?.role || req.user?.roleCode || ""
    ).toLowerCase();

    const canSeeAll = elevatedRoles.includes(currentRole);

    if (canSeeAll) {
      leaveRequestsResult = await query(
        `
        SELECT
          lr.id,
          lr.employee_id AS "employeeId",
          e.gas_id AS "employeeGasId",
          e.full_name AS "employeeName",
          lr.type,
          lr.note,
          lr.current_bank AS "currentBank",
          lr.new_bank AS "newBank",
          lr.new_iban AS "newIban",
          lr.start_date AS "startDate",
          lr.end_date AS "endDate",
          lr.status,
          lr.requested_by AS "requestedBy",
          lr.requested_by_name AS "requestedByName",
          lr.reviewer_name AS "reviewerName",
          lr.attachment_path AS "attachmentPath",
          lr.created_at AS "createdAt"
        FROM leave_requests lr
        LEFT JOIN employees e ON e.id = lr.employee_id
        ORDER BY lr.created_at DESC, lr.id DESC
        `
      );
    } else if (currentEmployee?.id) {
      leaveRequestsResult = await query(
        `
        SELECT
          lr.id,
          lr.employee_id AS "employeeId",
          e.gas_id AS "employeeGasId",
          e.full_name AS "employeeName",
          lr.type,
          lr.note,
          lr.current_bank AS "currentBank",
          lr.new_bank AS "newBank",
          lr.new_iban AS "newIban",
          lr.start_date AS "startDate",
          lr.end_date AS "endDate",
          lr.status,
          lr.requested_by AS "requestedBy",
          lr.requested_by_name AS "requestedByName",
          lr.reviewer_name AS "reviewerName",
          lr.attachment_path AS "attachmentPath",
          lr.created_at AS "createdAt"
        FROM leave_requests lr
        LEFT JOIN employees e ON e.id = lr.employee_id
        WHERE lr.employee_id = $1
           OR lr.requested_by = $2
        ORDER BY lr.created_at DESC, lr.id DESC
        `,
        [currentEmployee.id, username || req.user?.username || ""]
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
router.post("/leave", async (req, res) => {
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

    await query(
      `
      INSERT INTO leave_requests (
        employee_id,
        type,
        note,
        current_bank,
        new_bank,
        new_iban,
        start_date,
        end_date,
        requested_by,
        requested_by_name,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending')
      `,
      [
        employee.id,
        normalizedType,
        note || null,
        currentBank || null,
        newBank || null,
        newIban || null,
        startDate || null,
        endDate || null,
        requestedBy || req.user?.username || null,
        req.user?.name || req.user?.username || employee.full_name || null,
      ]
    );

    return res.json({ message: "Request created successfully" });
  } catch (error) {
    console.error("Create request error:", error);
    return res.status(500).json({ message: "Failed to create request" });
  }
});

export default router;
