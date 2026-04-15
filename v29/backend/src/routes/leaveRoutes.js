import express from "express";
import { query } from "../data/index.js";

const router = express.Router();

/**
 * Get request types
 */
router.get("/types", async (_req, res) => {
  try {
    return res.json([
      { code: "leave", name: "إجازة" },
      { code: "task", name: "تكليف" },
      { code: "salary_transfer", name: "تحويل راتب" },
    ]);
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

    return res.json(result.rows || []);
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

    const userResult = await query(
      `
      SELECT id, username
      FROM users
      WHERE username = $1
      LIMIT 1
      `,
      [username]
    );

    const currentUser = userResult.rows[0];

    if (!currentUser) {
      return res.status(404).json({ message: "المستخدم غير موجود" });
    }

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
    const { employee_id, type, note } = req.body;

    if (!employee_id || !type) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    await query(
      `
      INSERT INTO leave_requests (employee_id, type, note, status)
      VALUES ($1, $2, $3, 'pending')
      `,
      [employee_id, type, note || null]
    );

    return res.json({ message: "Request created successfully" });
  } catch (error) {
    console.error("Create request error:", error);
    return res.status(500).json({ message: "Failed to create request" });
  }
});

export default router;
