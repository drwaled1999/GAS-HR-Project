import express from "express";
import { query } from "../data/index.js";

const router = express.Router();

router.get("/monthly", async (req, res) => {
  try {
    const month = Number(req.query.month);
    const year = Number(req.query.year);
    const username = req.query.username || req.user?.username;

    if (!month || !year) {
      return res.status(400).json({ message: "Month and year are required" });
    }

    if (!username) {
      return res.status(400).json({ message: "Username is required" });
    }

    const userResult = await query(
      `
      SELECT id, username, employee_id
      FROM users
      WHERE username = $1
      LIMIT 1
      `,
      [username]
    );

    const currentUser = userResult.rows[0];

    if (!currentUser) {
      return res.status(404).json({ message: "User not found" });
    }

    let employeeCode = username;

    if (currentUser.employee_id) {
      const employeeResult = await query(
        `
        SELECT gas_id
        FROM employees
        WHERE id = $1
        LIMIT 1
        `,
        [currentUser.employee_id]
      );

      if (employeeResult.rows[0]?.gas_id) {
        employeeCode = employeeResult.rows[0].gas_id;
      }
    }

    const recordsResult = await query(
      `
      SELECT
        id,
        employee_code,
        work_date,
        COALESCE(hours, 0) AS hours,
        COALESCE(status, 'present') AS status,
        created_at,
        updated_at
      FROM attendance_records
      WHERE employee_code = $1
        AND EXTRACT(MONTH FROM work_date) = $2
        AND EXTRACT(YEAR FROM work_date) = $3
      ORDER BY work_date ASC
      `,
      [employeeCode, month, year]
    );

    return res.json({
      month,
      year,
      employeeCode,
      records: recordsResult.rows || []
    });
  } catch (error) {
    console.error("Monthly attendance error:", error);
    return res.status(500).json({ message: "Failed to load monthly attendance" });
  }
});

export default router;
