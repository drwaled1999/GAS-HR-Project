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
  return String(value || "")
    .replace(/[^\d]/g, "")
    .trim();
}

function normalizeDate(value) {
  const raw = clean(value);
  if (!raw) return null;

  const directDate = new Date(raw);
  if (!Number.isNaN(directDate.getTime())) {
    return directDate.toISOString().slice(0, 10);
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
  const rowKeys = Object.keys(row);

  for (const candidate of candidates) {
    const found = rowKeys.find(
      (key) => clean(key).toLowerCase() === candidate.toLowerCase()
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
    `SELECT id, full_name, gas_id FROM employees WHERE gas_id = $1 LIMIT 1`,
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
    `SELECT id, username FROM users WHERE employee_id = $1 LIMIT 1`,
    [employeeId]
  );

  let createdUser = false;

  if (existingUser.rows.length === 0) {
    const roleResult = await query(
      `SELECT id FROM roles WHERE code = 'employee' LIMIT 1`
    );

    let username = buildUsernameFromNameAndGasId(resolvedName, resolvedGasId);

    let counter = 1;
    while (true) {
      const duplicateCheck = await query(
        `SELECT id FROM users WHERE username = $1 LIMIT 1`,
        [username]
      );

      if (duplicateCheck.rows.length === 0) break;

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

    createdUser = true;
  }

  return {
    employeeId,
    createdUser,
    gasId: resolvedGasId,
    fullName: resolvedName,
  };
}

function mapCsvRow(row) {
  const gasId = normalizeGasId(
    findColumn(row, [
      "user id",
      "userid",
      "user_id",
      "gas id",
      "gas_id",
      "emp id",
      "employee id",
      "id",
    ])
  );

  const fullName = clean(
    findColumn(row, [
      "name",
      "employee name",
      "employee_name",
      "full name",
      "full_name",
    ])
  );

  const workDate = normalizeDate(
    findColumn(row, [
      "date",
      "attendance date",
      "attendance_date",
      "work date",
      "work_date",
    ])
  );

  const regular = clean(
    findColumn(row, [
      "regular",
      "status",
      "attendance status",
      "attendance_status",
    ])
  );

  const regularHours = normalizeHours(
    findColumn(row, [
      "regular hours",
      "regular_hours",
      "hours",
      "work hours",
      "work_hours",
      "duration",
    ])
  );

  let resolvedStatus = "A";

  if (!regular && regularHours <= 0) {
    resolvedStatus = "A";
  } else {
    const normalizedRegular = regular.toLowerCase();

    if (
      ["single punch", "single_punch", "single", "sp"].includes(normalizedRegular)
    ) {
      resolvedStatus = "SP";
    } else if (
      ["present", "p", "regular", "complete"].includes(normalizedRegular)
    ) {
      resolvedStatus = "P";
    } else if (
      ["absent", "a"].includes(normalizedRegular)
    ) {
      resolvedStatus = "A";
    } else if (regularHours > 0 && regularHours < 8) {
      resolvedStatus = "SP";
    } else if (regularHours >= 8) {
      resolvedStatus = "P";
    } else {
      resolvedStatus = "A";
    }
  }

  return {
    gasId,
    fullName,
    workDate,
    regular: regular || resolvedStatus,
    regularHours,
    status: resolvedStatus,
  };
}

router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded." });
    }

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

    let inserted = 0;
    let updated = 0;
    let createdUsers = 0;
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

        const ensured = await getOrCreateEmployeeAndUser({
          fullName: mapped.fullName,
          gasId: mapped.gasId,
        });

        if (ensured.createdUser) {
          createdUsers += 1;
        }

        const attendanceExists = await query(
          `
          SELECT id
          FROM attendance_records
          WHERE employee_id = $1 AND work_date = $2
          LIMIT 1
          `,
          [ensured.employeeId, mapped.workDate]
        );

        if (attendanceExists.rows.length > 0) {
          await query(
            `
            UPDATE attendance_records
            SET
              status = $1,
              hours = $2,
              updated_at = NOW()
            WHERE id = $3
            `,
            [mapped.status, mapped.regularHours, attendanceExists.rows[0].id]
          );
          updated += 1;
        } else {
          await query(
            `
            INSERT INTO attendance_records
              (employee_id, work_date, status, hours)
            VALUES ($1, $2, $3, $4)
            `,
            [ensured.employeeId, mapped.workDate, mapped.status, mapped.regularHours]
          );
          inserted += 1;
        }
      } catch (rowError) {
        errors.push({
          row,
          message: rowError.message,
        });
      }
    }

    return res.json({
      message: "Attendance uploaded successfully.",
      summary: {
        totalRows: records.length,
        inserted,
        updated,
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

router.get("/", async (req, res) => {
  try {
    const month = clean(req.query.month);
    const year = clean(req.query.year);
    const gasId = normalizeGasId(req.query.gasId);

    let sql = `
      SELECT
        a.id,
        a.work_date,
        a.status,
        a.hours,
        e.gas_id,
        e.full_name AS name
      FROM attendance_records a
      LEFT JOIN employees e ON e.id = a.employee_id
    `;

    const conditions = [];
    const params = [];

    if (month) {
      params.push(Number(month));
      conditions.push(`EXTRACT(MONTH FROM a.work_date) = $${params.length}`);
    }

    if (year) {
      params.push(Number(year));
      conditions.push(`EXTRACT(YEAR FROM a.work_date) = $${params.length}`);
    }

    if (gasId) {
      params.push(gasId);
      conditions.push(`e.gas_id = $${params.length}`);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(" AND ")}`;
    }

    sql += ` ORDER BY a.work_date DESC, e.full_name ASC`;

    const result = await query(sql, params);

    return res.json({
      records: result.rows.map((row) => ({
        id: row.id,
        userId: row.gas_id || "",
        gasId: row.gas_id || "",
        name: row.name || "",
        date: row.work_date,
        regular: row.status === "P" ? "Present" : row.status === "SP" ? "Single Punch" : "A",
        status: row.status || "A",
        regularHours: row.hours || 0,
        hours: row.hours || 0,
      })),
    });
  } catch (error) {
    console.error("Get attendance error:", error);
    return res.status(500).json({ message: "Failed to load attendance." });
  }
});

export default router;