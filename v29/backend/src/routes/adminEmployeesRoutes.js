import express from "express";
import { query } from "../data/index.js";
import { requireAuth } from "../middleware_auth.js";

const router = express.Router();

router.use(requireAuth);

function normalizeRole(user) {
  return String(user?.roleName || user?.role || "").trim().toLowerCase();
}

function canManageEmployees(user) {
  const role = normalizeRole(user);
  return ["system owner", "hr manager", "hr admin", "admin"].includes(role);
}

function requireEmployeeAdmin(req, res, next) {
  if (!canManageEmployees(req.user)) {
    return res.status(403).json({ message: "Access denied" });
  }
  next();
}

router.get("/", requireEmployeeAdmin, async (req, res) => {
  try {
    const result = await query(`
      SELECT
        id,
        full_name,
        gas_id,
        nationality,
        job_title,
        project_name,
        package_name,
        phone,
        email,
        id_number,
        join_date,
        address,
        sabul_short_address,
        education,
        emergency_contact,
        status,
        updated_at
      FROM employees
      ORDER BY full_name ASC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error("GET ADMIN EMPLOYEES ERROR:", err);
    res.status(500).json({ message: "Failed to load employees" });
  }
});

router.put("/:id", requireEmployeeAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const {
      phone,
      email,
      id_number,
      join_date,
      address,
      sabul_short_address,
      education,
      emergency_contact,
      status,
    } = req.body;

    const result = await query(
      `
      UPDATE employees
      SET
        phone = $1,
        email = $2,
        id_number = $3,
        join_date = $4,
        address = $5,
        sabul_short_address = $6,
        education = $7,
        emergency_contact = $8,
        status = $9,
        updated_at = NOW()
      WHERE id = $10
      RETURNING *
      `,
      [
        phone || null,
        email || null,
        id_number || null,
        join_date || null,
        address || null,
        sabul_short_address || null,
        education || null,
        emergency_contact || null,
        status || "Active",
        id,
      ]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "Employee not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("UPDATE EMPLOYEE ERROR:", err);
    res.status(500).json({ message: "Failed to update employee" });
  }
});

export default router;
