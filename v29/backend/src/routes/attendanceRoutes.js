import express from "express";
import multer from "multer";
import bcrypt from "bcryptjs";
import { parse } from "csv-parse/sync";
import { query } from "../data/index.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeGasId(value) {
  return String(value || "")
    .replace(/[^\d]/g, "")
    .trim();
}

function normalizeDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  const parts = raw.split(/[\/\-]/).map((x) => x.trim());
  if (parts.length === 3) {
    let [d, m, y] = parts;
    if (y.length === 2) y = `20${y}`;
    if (d.length === 1) d = `0${d}`;
    if (m.length === 1) m = `0${m}`;
    return `${y}-${m}-${d}`;
  }

  const asDate = new Date(raw);
  if (!Number.isNaN(asDate.getTime())) {
    return asDate.toISOString().slice(0, 10);
  }

  return null;
}

function normalizeHours(value) {
  const num = Number(String(value || "").replace(/[^\d.]/g, ""));
  return Number.isFinite(num) ? num : 0;
}

function normalizeStatus(value) {
  const v = String(value || "").trim().toLowerCase();

  if (!v) return "P";
  if (["a", "absent"].includes(v)) return "A";
  if (["p", "present"].includes(v)) return "P";
  if (["sp", "single punch", "single_punch"].includes(v)) return "SP";
  if (["h", "holiday"].includes(v)) return "H";
  if (["sl", "sick", "sick leave"].includes(v)) return "SL";
  if (["v", "vacation"].includes(v)) return "V";

  return String(value || "P").trim();
}

function findValue(row, keys) {
  for (const key of keys) {
    const found = Object.keys(row).find(
      (k) => String(k).trim().toLowerCase() === key.toLowerCase()
    );
    if (found) return row[found];
  }
  return "";
}

async function ensureEmployeeAndUser({
  fullName,
  gasId,
}) {
  const cleanName = normalizeText(fullName);
  const cleanGasId = normalizeGasId(gasId);

  if (!cleanName || !cleanGasId) {
    return null;
  }

  const employeeRes = await query(
    `SELECT id, full_name, gas_id FROM employees WHERE gas_id = $1 LIMIT 1`,
    [cleanGasId]
  );

  let employeeId;

  if (employeeRes.rows.length > 0) {
    employeeId = employeeRes.rows[0].id;

    await query(
      `
      UPDATE employees
      SET full_name = COALESCE(NULLIF($1, ''), full_name),
          updated_at = NOW()
      WHERE id = $2
      `,
      [cleanName, employeeId]
    );
  } else {
    const insertedEmployee = await query(
      `
      INSERT INTO employees (full_name, gas_id, status)
      VALUES ($1, $2, 'active')
      RETURNING id
      `,
      [cleanName, cleanGasId]
    );

    employeeId = insertedEmployee.rows[0].id;
  }

  const userRes = await query(
    `SELECT id FROM users WHERE employee_id = $1 LIMIT 1`,
    [employeeId]
  );

  if (userRes.rows.length === 0) {
    const usernameBase = cleanName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ".")
      .replace(/^\.+|\.+$/g, "");

    const fallbackUsername = usernameBase || `user.${cleanGasId}`;
    let username = fallbackUsername;

    let counter = 1;
    while (true) {
      const exists = await query(
        `SELECT id FROM users WHERE username = $1 LIMIT 1`,
        [username]
      );
      if (exists.rows.length === 0) break;
      counter += 1;
      username = `${fallbackUsername}.${counter}`;
    }

    const roleResult = await query(
      `SELECT id FROM roles WHERE code = 'employee' LIMIT 1`
    );

    const passwordHash = await bcrypt.hash(cleanGasId, 10);

    await query(
      `
      INSERT INTO users
        (username, password_hash, full_name, role_id, employee_id, is_active)
      VALUES ($1, $2, $3, $4, $5, TRUE)
      `,
      [username, passwordHash, cleanName, roleResult.rows[0]?.id || null, employeeId]
    );
  }

  return { employeeId, gasId: cleanGasId, fullName: cleanName };
}

router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded." });
    }

    const fileContent = req.file.buffer.toString("utf8");

    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      bom: true,
      trim: true,
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
        const gasId = normalizeGasId(
          findValue(row, ["gas_id", "gas id", "GAS ID", "userid", "user id", "emp id"])
        );

        const fullName = normalizeText(
          findValue(row, ["name", "employee", "employee_name", "full name", "employee name"])
        );

        const workDate = normalizeDate(
          findValue(row, ["date", "work_date", "attendance_date"])
        );

        const status = normalizeStatus(
          findValue(row, ["status", "attendance_status"])
        );

        const hours = normalizeHours(
          findValue(row, ["hours", "work_hours", "duration"])
        );

        if (!gasId || !fullName || !workDate) {
          errors.push({
            row,
            message: "Missing GAS ID, name, or date",
          });
          continue;
        }

        const ensured = await ensureEmployeeAndUser({
          fullName,
          gasId,
        });

        if (!ensured?.employeeId) {
          errors.push({
            row,
            message: "Failed to resolve employee",
          });
          continue;
        }

        const userCheck = await query(
          `SELECT id FROM users WHERE employee_id = $1 LIMIT 1`,
          [ensured.employeeId]
        );
        if (userCheck.rows.length > 0) {
          createdUsers += 0;
        }

        const existingAttendance = await query(
          `
          SELECT id
          FROM attendance_records
          WHERE employee_id = $1 AND work_date = $2
          LIMIT 1
          `,
          [ensured.employeeId, workDate]
        );

        if (existingAttendance.rows.length > 0) {
          await query(
            `
            UPDATE attendance_records
            SET
              status = $1,
              hours = $2,
              updated_at = NOW()
            WHERE id = $3
            `,
            [status, hours, existingAttendance.rows[0].id]
          );
          updated += 1;
        } else {
          await query(
            `
            INSERT INTO attendance_records
              (employee_id, work_date, status, hours)
            VALUES ($1, $2, $3, $4)
            `,
            [ensured.employeeId, workDate, status, hours]
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
      errors: errors.slice(0, 20),
    });
  } catch (error) {
    console.error("Attendance upload error:", error);
    return res.status(500).json({ message: error.message || "Failed to upload attendance file." });
  }
});

router.get("/", async (req, res) => {
  try {
    const month = String(req.query.month || "").trim();
    const year = String(req.query.year || "").trim();

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

    const params = [];
    const conditions = [];

    if (month) {
      params.push(Number(month));
      conditions.push(`EXTRACT(MONTH FROM a.work_date) = $${params.length}`);
    }

    if (year) {
      params.push(Number(year));
      conditions.push(`EXTRACT(YEAR FROM a.work_date) = $${params.length}`);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(" AND ")}`;
    }

    sql += ` ORDER BY a.work_date DESC, e.full_name ASC`;

    const result = await query(sql, params);

    return res.json({
      records: result.rows.map((row) => ({
        id: row.id,
        gasId: row.gas_id || "",
        name: row.name || "",
        date: row.work_date,
        status: row.status || "",
        hours: row.hours || 0,
      })),
    });
  } catch (error) {
    console.error("Load attendance error:", error);
    return res.status(500).json({ message: "Failed to load attendance." });
  }
});

export default router;