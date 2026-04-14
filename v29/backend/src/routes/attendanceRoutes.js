import express from "express";
import multer from "multer";
import bcrypt from "bcryptjs";
import { parse } from "csv-parse/sync";
import { query } from "../data/index.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
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
    let [, m, d, y] = match;
    if (y.length === 2) y = `20${y}`;
    m = m.padStart(2, "0");
    d = d.padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  return null;
}

function normalizeHours(value) {
  const raw = clean(value);
  if (!raw) return 0;

  if (/^\d{1,2}:\d{2}:\d{2}$/.test(raw)) {
    const [h, m, s] = raw.split(":").map(Number);
    return Number((h + m / 60 + s / 3600).toFixed(2));
  }

  if (/^\d{1,2}:\d{2}$/.test(raw)) {
    const [h, m] = raw.split(":").map(Number);
    return Number((h + m / 60).toFixed(2));
  }

  const num = Number(raw.replace(/[^\d.]/g, ""));
  return Number.isFinite(num) ? num : 0;
}

function findColumnValue(row, candidates) {
  const keys = Object.keys(row || {});
  for (const candidate of candidates) {
    const foundKey = keys.find(
      (k) => clean(k).toLowerCase() === candidate.toLowerCase()
    );
    if (foundKey) return row[foundKey];
  }
  return "";
}

function deriveStatus(exceptionValue, regularHours) {
  const exceptionText = clean(exceptionValue).toLowerCase();
  const hours = normalizeHours(regularHours);

  if (exceptionText.includes("absence")) return "A";
  if (exceptionText.includes("insufficient")) return "SP";
  if (hours <= 0) return "A";
  if (hours > 0 && hours < 8) return "SP";
  return "P";
}

function mapCsvRow(row) {
  const workDate = normalizeDate(findColumnValue(row, ["date"]));
  const fullName = clean(findColumnValue(row, ["name"]));
  const gasId = normalizeGasId(findColumnValue(row, ["user id"]));
  const exceptionValue = clean(findColumnValue(row, ["exception"]));
  const regularHoursRaw = findColumnValue(row, ["regular hours"]);
  const regularHours = normalizeHours(regularHoursRaw);
  const derivedStatus = deriveStatus(exceptionValue, regularHoursRaw);

  return {
    gasId,
    fullName,
    workDate,
    regularHours,
    derivedStatus,
    rawJson: row,
  };
}

function buildUsernameFromNameAndGasId(name, gasId) {
  const base = clean(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");

  return base ? `${base}.${gasId}` : `user.${gasId}`;
}

async function getOrCreateEmployeeByGasId({ gasId, fullName }) {
  const resolvedGasId = normalizeGasId(gasId);
  const resolvedName = clean(fullName);

  if (!resolvedGasId) throw new Error("Missing gas id");

  const existingEmployee = await query(
    `SELECT id, full_name FROM employees WHERE gas_id = $1 LIMIT 1`,
    [resolvedGasId]
  );

  let employeeId;

  if (existingEmployee.rows.length > 0) {
    employeeId = existingEmployee.rows[0].id;

    if (resolvedName) {
      await query(
        `
        UPDATE employees
        SET full_name = COALESCE(NULLIF($1, ''), full_name),
            updated_at = NOW()
        WHERE id = $2
        `,
        [resolvedName, employeeId]
      );
    }
  } else {
    const inserted = await query(
      `
      INSERT INTO employees (full_name, gas_id, status)
      VALUES ($1, $2, 'active')
      RETURNING id
      `,
      [resolvedName || `Employee ${resolvedGasId}`, resolvedGasId]
    );

    employeeId = inserted.rows[0].id;
  }

  const existingUser = await query(
    `SELECT id FROM users WHERE employee_id = $1 LIMIT 1`,
    [employeeId]
  );

  if (existingUser.rows.length === 0) {
    const roleResult = await query(
      `SELECT id FROM roles WHERE code = 'employee' LIMIT 1`
    );

    let username = buildUsernameFromNameAndGasId(
      resolvedName || `employee.${resolvedGasId}`,
      resolvedGasId
    );

    let counter = 1;
    while (true) {
      const duplicate = await query(
        `SELECT id FROM users WHERE username = $1 LIMIT 1`,
        [username]
      );
      if (duplicate.rows.length === 0) break;
      counter += 1;
      username = `${buildUsernameFromNameAndGasId(
        resolvedName || `employee.${resolvedGasId}`,
        resolvedGasId
      )}.${counter}`;
    }

    const passwordHash = await bcrypt.hash(resolvedGasId, 10);

    await query(
      `
      INSERT INTO users
        (username, password_hash, full_name, role_id, employee_id, is_active)
      VALUES ($1, $2, $3, $4, $5, TRUE)
      `,
      [
        username,
        passwordHash,
        resolvedName || `Employee ${resolvedGasId}`,
        roleResult.rows[0]?.id || null,
        employeeId,
      ]
    );
  }

  return employeeId;
}

router.get("/ping", (_req, res) => {
  res.json({ ok: true });
});

router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded." });
    }

    const uploadedBy = clean(req.body.username || "system");
    const monthInt = Number(req.body.month || 0) || null;
    const yearInt = Number(req.body.year || 0) || null;

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
      [req.file.originalname, uploadedBy, monthInt, yearInt]
    );

    const batchId = batchInsert.rows[0].id;

    const validRows = [];
    const uniqueEmployees = new Map();
    const errors = [];

    for (const row of records) {
      try {
        const mapped = mapCsvRow(row);

        if (!mapped.gasId || !mapped.workDate) {
          errors.push({ row, message: "Missing User ID or Date" });
          continue;
        }

        validRows.push(mapped);

        if (!uniqueEmployees.has(mapped.gasId)) {
          uniqueEmployees.set(mapped.gasId, {
            gasId: mapped.gasId,
            fullName: mapped.fullName,
          });
        }
      } catch (error) {
        errors.push({ row, message: error.message });
      }
    }

    const employeeMap = new Map();

    for (const employee of uniqueEmployees.values()) {
      const employeeId = await getOrCreateEmployeeByGasId(employee);
      employeeMap.set(employee.gasId, employeeId);
    }

    for (const row of validRows) {
      await query(
        `
        INSERT INTO attendance_import_rows
          (import_batch_id, employee_id, gas_id, employee_name, work_date, regular_hours, derived_status, raw_json)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
        `,
        [
          batchId,
          employeeMap.get(row.gasId) || null,
          row.gasId,
          row.fullName || null,
          row.workDate,
          row.regularHours,
          row.derivedStatus,
          JSON.stringify(row.rawJson),
        ]
      );
    }

    return res.json({
      message: "تم رفع الملف بنجاح",
      batchId,
      summary: {
        totalRows: records.length,
        savedRows: validRows.length,
        failed: errors.length,
      },
      errors: errors.slice(0, 20),
    });
  } catch (error) {
    console.error("Attendance upload error:", error);
    return res.status(500).json({ message: error.message || "Upload failed" });
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

    let rowsResult;

    if (batchId) {
      rowsResult = await query(
        `
        SELECT
          ir.id,
          ir.employee_id,
          ir.gas_id,
          ir.employee_name,
          ir.work_date,
          ir.regular_hours,
          ir.derived_status,
          ir.status_override,
          ir.notes,
          e.full_name,
          e.job_title,
          e.nationality
        FROM attendance_import_rows ir
        LEFT JOIN employees e ON e.id = ir.employee_id
        WHERE ir.import_batch_id = $1
        ORDER BY COALESCE(e.full_name, ir.employee_name), ir.work_date
        `,
        [batchId]
      );
    } else {
      rowsResult = await query(
        `
        SELECT
          a.id,
          a.employee_id,
          e.gas_id,
          e.full_name AS employee_name,
          a.work_date,
          a.hours AS regular_hours,
          a.status AS derived_status,
          NULL AS status_override,
          NULL AS notes,
          e.full_name,
          e.job_title,
          e.nationality
        FROM attendance_records a
        LEFT JOIN employees e ON e.id = a.employee_id
        WHERE EXTRACT(MONTH FROM a.work_date) = $1
          AND EXTRACT(YEAR FROM a.work_date) = $2
        ORDER BY e.full_name, a.work_date
        `,
        [month, year]
      );
    }

    const grouped = new Map();

    for (const row of rowsResult.rows) {
      const key = row.gas_id || row.employee_id || row.employee_name || row.id;

      if (!grouped.has(key)) {
        grouped.set(key, {
          rowId: row.id,
          employeeId: row.employee_id || "",
          gasId: row.gas_id || "",
          name: row.full_name || row.employee_name || "",
          tradeCategory: row.job_title || "",
          nationality: row.nationality || "",
          days: {},
        });
      }

      const item = grouped.get(key);
      const day = new Date(row.work_date).getDate();

      item.days[day] = {
        importRowId: row.id,
        status: row.status_override || row.derived_status || "A",
        regularHours: Number(row.regular_hours || 0),
        notes: row.notes || "",
      };
    }

    const employees = Array.from(grouped.values()).map((employee, index) => {
      const days = {};
      for (let d = 1; d <= daysInMonth; d += 1) {
        days[d] = employee.days[d] || {
          importRowId: null,
          status: "A",
          regularHours: 0,
          notes: "",
        };
      }

      return {
        sno: index + 1,
        ...employee,
        days,
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
    return res.status(500).json({ message: error.message || "Sheet failed" });
  }
});

router.patch("/row/:id", async (req, res) => {
  try {
    const rowId = Number(req.params.id);
    const { statusOverride, notes } = req.body || {};

    const allowedStatuses = ["P", "A", "SP", "SKL", "SL", "VAC", "H"];
    const nextStatus = clean(statusOverride).toUpperCase();

    if (!allowedStatuses.includes(nextStatus)) {
      return res.status(400).json({ message: "Invalid status override" });
    }

    await query(
      `
      UPDATE attendance_import_rows
      SET status_override = $1,
          notes = $2
      WHERE id = $3
      `,
      [nextStatus, clean(notes), rowId]
    );

    return res.json({ message: "تم تعديل الحالة بنجاح" });
  } catch (error) {
    console.error("Attendance row update error:", error);
    return res.status(500).json({ message: error.message || "Update failed" });
  }
});

router.post("/approve/:batchId", async (req, res) => {
  try {
    const batchId = Number(req.params.batchId);
    const approvedBy = clean(req.body.username || "system");
    const role = clean(req.body.role || "").toLowerCase();

    const allowedRoles = ["owner", "system owner", "hr_manager", "hr manager"];
    if (!allowedRoles.includes(role)) {
      return res.status(403).json({
        message: "Only HR Manager or System Owner can approve",
      });
    }

    const batchResult = await query(
      `SELECT id, status FROM attendance_import_batches WHERE id = $1 LIMIT 1`,
      [batchId]
    );

    if (batchResult.rows.length === 0) {
      return res.status(404).json({ message: "Batch not found" });
    }

    if (batchResult.rows[0].status === "approved") {
      return res.status(400).json({ message: "Batch already approved" });
    }

    const rowsResult = await query(
      `
      SELECT
        id,
        employee_id,
        gas_id,
        work_date,
        regular_hours,
        derived_status,
        status_override
      FROM attendance_import_rows
      WHERE import_batch_id = $1
      ORDER BY work_date ASC, id ASC
      `,
      [batchId]
    );

    let inserted = 0;
    let updated = 0;

    for (const row of rowsResult.rows) {
      let employeeId = row.employee_id;

      if (!employeeId && row.gas_id) {
        const lookup = await query(
          `SELECT id FROM employees WHERE gas_id = $1 LIMIT 1`,
          [row.gas_id]
        );
        employeeId = lookup.rows[0]?.id || null;
      }

      if (!employeeId) continue;

      const finalStatus = row.status_override || row.derived_status || "A";
      const finalHours = finalStatus === "A" || finalStatus === "H" || finalStatus === "VAC" || finalStatus === "SL" || finalStatus === "SKL"
        ? 0
        : Number(row.regular_hours || 0);

      const existing = await query(
        `
        SELECT id
        FROM attendance_records
        WHERE employee_id = $1 AND work_date = $2
        LIMIT 1
        `,
        [employeeId, row.work_date]
      );

      if (existing.rows.length > 0) {
        await query(
          `
          UPDATE attendance_records
          SET status = $1,
              hours = $2,
              source_batch_id = $3,
              updated_at = NOW()
          WHERE id = $4
          `,
          [finalStatus, finalHours, batchId, existing.rows[0].id]
        );
        updated += 1;
      } else {
        await query(
          `
          INSERT INTO attendance_records
            (employee_id, work_date, status, hours, source_batch_id)
          VALUES ($1, $2, $3, $4, $5)
          `,
          [employeeId, row.work_date, finalStatus, finalHours, batchId]
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
      message: "تم اعتماد الحضور بنجاح",
      summary: { inserted, updated },
    });
  } catch (error) {
    console.error("Attendance approve error:", error);
    return res.status(500).json({ message: error.message || "Approve failed" });
  }
});

export default router;