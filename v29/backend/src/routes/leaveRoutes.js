import express from "express";
import { query } from "../data/index.js";

const router = express.Router();

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
          requiresBankFields: false
        },
        {
          code: "sick_leave",
          label: "إجازة مرضية",
          requiresAttachment: true,
          requiresDateRange: true,
          requiresBankFields: false
        },
        {
          code: "salary_transfer",
          label: "تحويل راتب",
          requiresAttachment: true,
          requiresDateRange: false,
          requiresBankFields: true
        }
      ]
    });
  } catch (error) {
    console.error("Request types error:", error);
    return res.status(500).json({ message: "Failed to load request types" });
  }
});

/**
 * Get employees list
 */
router.get("/list", async (_req, res) => {
  try {
    const result = await query(
      `
      SELECT
        id,
        gas_id,
        full_name
      FROM employees
      ORDER BY full_name ASC
      `
    );

    const employees = (result.rows || []).map((row) => ({
      id: row.id,
      gasId: row.gas_id,
      name: row.full_name || row.gas_id
    }));

    return res.json({
      employees,
      leaveRequests: [],
      attendanceAdjustments: []
    });
  } catch (error) {
    console.error("Requests list error:", error);
    return res.status(500).json({ message: "Failed to load employees" });
  }
});

/**
 * Get leave balances
 */
router.get("/balances", async (req, res) => {
  try {
    const username = req.query.username || req.user?.username || "owner";

    const employeeResult = await query(
      `
      SELECT id, gas_id, full_name
      FROM employees
      WHERE gas_id = $1
      LIMIT 1
      `,
      [username]
    );

    const employee = employeeResult.rows[0];

    if (!employee) {
      return res.json({
        balances: {
          annual: 30,
          sick: 15,
          emergency: 5
        }
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
        emergency: balance?.emergency_balance ?? 5
      }
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
      type,
      note,
      currentBank,
      newBank,
      newIban
    } = req.body;

    const finalEmployeeId = employeeId || employee_id;

    if (!finalEmployeeId || !type) {
      return res.status(400).json({ message: "Missing required fields" });
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
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'pending')
      `,
      [
        finalEmployeeId,
        type,
        note || null,
        currentBank || null,
        newBank || null,
        newIban || null
      ]
    );

    return res.json({ message: "Request created successfully" });
  } catch (error) {
    console.error("Create request error:", error);
    return res.status(500).json({ message: "Failed to create request" });
  }
});

export default router;
