import express from "express";
import { query } from "../data/index.js";
import { requireAuth } from "../middleware_auth.js";

const router = express.Router();

router.use(requireAuth);

// ================= 📥 GET MY REQUESTS =================
router.get("/", async (req, res) => {
  try {
    const user = req.user;

    const result = await query(
      `
      SELECT
        r.*,
        e.full_name,
        e.gas_id
      FROM employee_data_update_requests r
      JOIN employees e ON e.id = r.employee_id
      WHERE
        e.id = $1
        OR e.gas_id = $2
      ORDER BY r.created_at DESC
      `,
      [user.employeeId || user.id, user.gasId || null]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("GET EMPLOYEE REQUESTS ERROR:", err);
    res.status(500).json({ message: "Failed to load requests" });
  }
});

// ================= 📤 SUBMIT DATA =================
router.post("/:id/submit", async (req, res) => {
  try {
    const { id } = req.params;
    const { submitted_data, note } = req.body;

    const existing = await query(
      `SELECT * FROM employee_data_update_requests WHERE id=$1`,
      [id]
    );

    const item = existing.rows[0];

    if (!item) {
      return res.status(404).json({ message: "Request not found" });
    }

    if (item.status !== "pending_employee" && item.status !== "needs_correction") {
      return res.status(400).json({
        message: "This request cannot be submitted again",
      });
    }

    const updated = await query(
      `
      UPDATE employee_data_update_requests
      SET
        submitted_data = $1::jsonb,
        employee_note = $2,
        status = 'submitted',
        submitted_at = NOW()
      WHERE id = $3
      RETURNING *
      `,
      [
        JSON.stringify(submitted_data || {}),
        note || null,
        id,
      ]
    );

    res.json(updated.rows[0]);
  } catch (err) {
    console.error("SUBMIT DATA UPDATE ERROR:", err);
    res.status(500).json({ message: "Failed to submit data" });
  }
});

export default router;
