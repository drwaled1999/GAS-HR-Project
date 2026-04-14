import express from "express";
import multer from "multer";
import bcrypt from "bcryptjs";
import { parse } from "csv-parse/sync";
import { query } from "../data/index.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024,
  },
});

function clean(value) {
  return String(value || "").trim();
}

function normalizeGasId(value) {
  return String(value || "").replace(/[^\d]/g, "").trim();
}

function normalizeDate(value) {
  const raw = clean(value);
  if (!raw) return null;

  const direct = new Date(raw);
  if (!Number.isNaN(direct.getTime())) {
    return direct.toISOString().slice(0, 10);
  }

  const match = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (match) {
    let [, d, m, y] = match;
    if (y.length === 2) y = `20${y}`;
    d = d.padStart(2, "0");
    m = m.padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  return null;
}

function normalizeHours(value) {
  const raw = clean(value);
  if (!raw) return 0;

  if (/^\d{1,2}:\d{2}$/.test(raw)) {
    const [h, m] = raw.split(":").map(Number);
    return h + m / 60;
  }

  const num = Number(raw.replace(/[^\d.]/g, ""));
  return Number.isFinite(num) ? num : 0;
}

function findColumn(row, candidates) {
  const keys = Object.keys(row);
  for (const candidate of candidates) {
    const found = keys.find(
      (k) => clean(k).toLowerCase() === candidate.toLowerCase()
    );
    if (found) return row[found];
  }
  return "";
}

function buildUsernameFromNameAndGasId(name, gasId) {
  const base = clean(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");

  if (base) return `${base}.${gasId}`;
  return `user.${gasId}`;
}

async function getOrCreateEmployeeAndUser({ fullName, gasId }) {
  const resolvedName = clean(fullName);
  const resolvedGasId = normalizeGasId(gasId);

  if (!resolvedName || !resolvedGasId) {
    throw new Error("Missing fullName or gasId");
  }

  let employeeId = null;

  const employeeCheck = await query(
    `SELECT id, full_name, gas_id, nationality, job_title
     FROM employees
     WHERE gas_id = $1
     LIMIT 1`,
    [resolvedGasId]
  );

  if (employeeCheck.rows.length > 0) {
    employeeId = employeeCheck.rows[0].id;

    await query(
      `
      UPDATE employees
      SET
        full_name = COALESCE(NULLIF($1, ''), full_name),
        updated_at = NOW()
      WHERE id = $2
      `,
      [resolvedName, employeeId]
    );
  } else {
    const insertedEmployee = await query(
      `
      INSERT INTO employees (full_name, gas_id, status)
      VALUES ($1, $2, 'active')
      RETURNING id
      `,
      [resolvedName, resolvedGasId]
    );

    employeeId = insertedEmployee.rows[0].id;
  }

  const existingUser = await query(
    `SELECT id FROM users WHERE employee_id = $1 LIMIT 1`,
    [employeeId]
  );

  if (existingUser.rows.length === 0) {
    const roleResult = await query(
      `SELECT id FROM roles WHERE code = 'employee' LIMIT 1`
    );

    let username = buildUsernameFromNameAndGasId(resolvedName, resolvedGasId);

    let counter = 1;
    while (true) {
      const duplicate = await query(
        `SELECT id FROM users WHERE username = $1 LIMIT 1`,
        [username]
      );
      if (duplicate.rows.length === 0) break;
      counter += 1;
      username = `${buildUsernameFromNameAndGasId(resolvedName, resolvedGasId)}.${counter}`;
    }

    const passwordHash = await bcrypt.hash(resolvedGasId, 10);

    await query(
      `
      INSERT INTO users
        (username, password_hash, full_name, role_id, employee_id, is_active)
      VALUES ($1, $2, $3, $4, $5, TRUE)
      `,
      [username, passwordHash, resolvedName, roleResult.rows[0]?.id || null, employeeId]
    );
  }

  return employeeId;
}

function deriveStatus(regularValue, regularHours) {
  const regular = clean(regularValue).toLowerCase();
  const hours = normalizeHours(regularHours);

  if (!regular && hours <= 0) return "A";
  if (["sp", "single punch", "single_punch", "single"].includes(regular)) return "SP";
  if (["a", "absent"].includes(regular)) return "A";
  if (["p", "present", "regular", "complete"].includes(regular)) return "P";

  if (hours <= 0) return "A";
  if (hours > 0 && hours < 8) return "SP";
  return "P";
}

function mapCsvRow(row) {
  const gasId = normalizeGasId(
    findColumn(row, ["user id", "userid", "user_id", "gas id", "gas_id", "employee id", "id"])
  );

  const fullName = clean(
    findColumn(row, ["name", "employee name", "employee_name", "full name", "full_name"])
  );

  const workDate = normalizeDate(
    findColumn(row, ["date", "work date", "work_date", "attendance date", "attendance_date"])
  );

  const regularValue = clean(
    findColumn(row, ["regular", "status", "attendance status", "attendance_status"])
  );

  const regularHours = normalizeHours(
    findColumn(row, ["regular hours", "regular_hours", "hours", "work hours", "work_hours", "duration"])
  );

  const derivedStatus = deriveStatus(regularValue, regularHours);

  return {
    gasId,
    fullName,
    workDate,
    regularValue,
    regularHours,
    derivedStatus,
  };
}

router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded." });
    }

    const monthInt = Number(req.body.month || 0);
    const yearInt = Number(req.body.year || 0);
    const uploadedBy = clean(req.body.username || "system");

    const text = req.file.buffer.toString("utf8");
    const records = parse(text, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
      relax_column_count: true,
    });

    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ message: "CSV file is empty." });
    }

    const batchInsert = await query(
      `
      INSERT INTO attendance_import_batches
        (file_name, uploaded_by, month_int, year_int, status)
      VALUES ($1, $2, $3, $4, 'pending')
      RETURNING id
      `,
      [req.file.originalname, uploadedBy, monthInt || null, yearInt || null]
    );

    const batchId = batchInsert.rows[0].id;

    let createdUsers = 0;
    let savedRows = 0;
    const errors = [];

    for (const row of records) {
      try {
        const mapped = mapCsvRow(row);

        if (!mapped.gasId || !mapped.fullName || !mapped.workDate) {
          errors.push({
            row,
            message: "Missing User ID / Name / Date",
          });
          continue;
        }

        const employeeId = await getOrCreateEmployeeAndUser({
          fullName: mapped.fullName,
          gasId: mapped.gasId,
        });

        const existingUserCheck = await query(
          `SELECT id FROM users WHERE employee_id = $1 LIMIT 1`,
          [employeeId]
        );
        if (existingUserCheck.rows.length === 0) {
          createdUsers += 1;
        }

        await query(
          `
          INSERT INTO attendance_import_rows
            (batch_id, employee_id, employee_name, gas_id, work_date, regular_value, regular_hours, derived_status, raw_json)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
          `,
          [
            batchId,
            employeeId,
            mapped.fullName,
            mapped.gasId,
            mapped.workDate,
            mapped.regularValue,
            mapped.regularHours,
            mapped.derivedStatus,
            JSON.stringify(row),
          ]
        );

        savedRows += 1;
      } catch (rowError) {
        errors.push({
          row,
          message: rowError.message,
        });
      }
    }

    return res.json({
      message: "Attendance file uploaded and saved as pending.",
      batchId,
      summary: {
        totalRows: records.length,
        savedRows,
        createdUsers,
        failed: errors.length,
      },
      errors: errors.slice(0, 30),
    });
  } catch (error) {
    console.error("Attendance upload error:", error);
    return res.status(500).json({
      message: error.message || "Failed to upload attendance file.",
    });
  }
});

router.post("/approve/:batchId", async (req, res) => {
  try {
    const batchId = Number(req.params.batchId);
    const approvedBy = clean(req.body.username || "system");
    const role = clean(req.body.role || "").toLowerCase();

    if (!["hr manager", "system owner", "hr_manager", "owner"].includes(role)) {
      return res.status(403).json({ message: "Only HR Manager or System Owner can approve." });
    }

    const batchCheck = await query(
      `SELECT id, status FROM attendance_import_batches WHERE id = $1 LIMIT 1`,
      [batchId]
    );

    if (batchCheck.rows.length === 0) {
      return res.status(404).json({ message: "Batch not found." });
    }

    if (batchCheck.rows[0].status === "approved") {
      return res.status(400).json({ message: "Batch already approved." });
    }

    const rowsRes = await query(
      `
      SELECT id, employee_id, work_date, derived_status, regular_hours
      FROM attendance_import_rows
      WHERE batch_id = $1
      ORDER BY work_date ASC, id ASC
      `,
      [batchId]
    );

    let inserted = 0;
    let updated = 0;

    for (const row of rowsRes.rows) {
      const existing = await query(
        `
        SELECT id
        FROM attendance_records
        WHERE employee_id = $1 AND work_date = $2
        LIMIT 1
        `,
        [row.employee_id, row.work_date]
      );

      if (existing.rows.length > 0) {
        await query(
          `
          UPDATE attendance_records
          SET
            status = $1,
            hours = $2,
            updated_at = NOW()
          WHERE id = $3
          `,
          [row.derived_status, row.regular_hours, existing.rows[0].id]
        );
        updated += 1;
      } else {
        await query(
          `
          INSERT INTO attendance_records
            (employee_id, work_date, status, hours)
          VALUES ($1, $2, $3, $4)
          `,
          [row.employee_id, row.work_date, row.derived_status, row.regular_hours]
        );
        inserted += 1;
      }
    }

    await query(
      `
      UPDATE attendance_import_batches
      SET status = 'approved',
          approved_at = NOW(),
          approved_by = $1
      WHERE id = $2
      `,
      [approvedBy, batchId]
    );

    return res.json({
      message: "Attendance approved successfully.",
      summary: {
        inserted,
        updated,
      },
    });
  } catch (error) {
    console.error("Attendance approve error:", error);
    return res.status(500).json({ message: "Failed to approve attendance." });
  }
});

router.get("/sheet", async (req, res) => {
  try {
    const month = Number(req.query.month);
    const year = Number(req.query.year);
    const batchId = Number(req.query.batchId || 0);

    if (!month || !year) {
      return res.status(400).json({ message: "Month and year are required." });
    }

    const daysInMonth = new Date(year, month, 0).getDate();

    let rowsRes;

    if (batchId) {
      rowsRes = await query(
        `
        SELECT
          ir.id,
          ir.employee_id,
          ir.employee_name,
          ir.gas_id,
          ir.work_date,
          ir.regular_value,
          ir.regular_hours,
          ir.derived_status,
          e.nationality,
          e.job_title,
          e.gas_id AS employee_gas_id
        FROM attendance_import_rows ir
        LEFT JOIN employees e ON e.id = ir.employee_id
        WHERE ir.batch_id = $1
        `,
        [batchId]
      );
    } else {
      rowsRes = await query(
        `
        SELECT
          a.id,
          a.employee_id,
          e.full_name AS employee_name,
          e.gas_id,
          a.work_date,
          a.status AS regular_value,
          a.hours AS regular_hours,
          a.status AS derived_status,
          e.nationality,
          e.job_title,
          e.gas_id AS employee_gas_id
        FROM attendance_records a
        LEFT JOIN employees e ON e.id = a.employee_id
        WHERE EXTRACT(MONTH FROM a.work_date) = $1
          AND EXTRACT(YEAR FROM a.work_date) = $2
        `,
        [month, year]
      );
    }

    const grouped = new Map();

    for (const row of rowsRes.rows) {
      const employeeKey = `${row.employee_id || row.gas_id || row.employee_name}`;

      if (!grouped.has(employeeKey)) {
        grouped.set(employeeKey, {
          sno: grouped.size + 1,
          name: row.employee_name || "",
          tradeCategory: row.job_title || "",
          id: row.employee_id || "",
          gasId: row.gas_id || row.employee_gas_id || "",
          nationality: row.nationality || "",
          totalRegularHours: 0,
          days: {},
        });
      }

      const item = grouped.get(employeeKey);
      const dateObj = new Date(row.work_date);
      const dayNumber = dateObj.getDate();
      const hours = Number(row.regular_hours || 0);

      item.totalRegularHours += hours;

      item.days[dayNumber] = {
        value:
          row.derived_status === "SP"
            ? "SP"
            : row.derived_status === "P"
            ? "P"
            : "A",
        regularHours: hours,
        color:
          row.derived_status === "SP"
            ? "orange"
            : row.derived_status === "P"
            ? "green"
            : "red",
      };
    }

    const employees = Array.from(grouped.values()).map((employee) => {
      const filledDays = {};
      for (let d = 1; d <= daysInMonth; d += 1) {
        filledDays[d] = employee.days[d] || {
          value: "A",
          regularHours: 0,
          color: "red",
        };
      }

      return {
        ...employee,
        totalRegularHours: Number(employee.totalRegularHours.toFixed(2)),
        days: filledDays,
      };
    });

    return res.json({
      month,
      year,
      daysInMonth,
      employees,
    });
  } catch (error) {
    console.error("Attendance sheet error:", error);
    return res.status(500).json({ message: "Failed to load attendance sheet." });
  }
});

export default router;