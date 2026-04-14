import express from "express";
import multer from "multer";
import { parse } from "csv-parse/sync";
import { query } from "../data/index.js";

const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

function hoursToNumber(val) {
  if (!val) return 0;
  if (val.includes(":")) {
    const [h, m, s] = val.split(":").map(Number);
    return h + m / 60 + s / 3600;
  }
  return Number(val) || 0;
}

function getStatus(hours) {
  if (hours === 0) return "A";
  if (hours < 8) return "SP";
  return "P";
}

router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const text = req.file.buffer.toString("utf8");

    const rows = parse(text, {
      columns: true,
      skip_empty_lines: true,
    });

    // إنشاء batch
    const batch = await query(`
      INSERT INTO attendance_import_batches (file_name)
      VALUES ($1)
      RETURNING id
    `, [req.file.originalname]);

    const batchId = batch.rows[0].id;

    for (const row of rows) {
      const gasId = row["User ID"];
      const name = row["Name"];
      const date = new Date(row["Date"]);
      const hours = hoursToNumber(row["Regular hours"]);

      // نجيب UUID من employees
      const emp = await query(
        `SELECT id FROM employees WHERE gas_id = $1`,
        [gasId]
      );

      if (!emp.rows.length) continue;

      const employeeId = emp.rows[0].id;

      await query(`
        INSERT INTO attendance_import_rows
        (import_batch_id, employee_id, gas_id, employee_name, work_date, regular_hours, derived_status)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
      `, [
        batchId,
        employeeId,
        gasId,
        name,
        date,
        hours,
        getStatus(hours)
      ]);
    }

    res.json({ message: "Uploaded", batchId });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});


// 🔥 الموافقة
router.post("/approve/:id", async (req, res) => {
  const batchId = req.params.id;

  const rows = await query(
    `SELECT * FROM attendance_import_rows WHERE import_batch_id = $1`,
    [batchId]
  );

  for (const r of rows.rows) {
    await query(`
      INSERT INTO attendance_records (employee_id, work_date, status, hours)
      VALUES ($1,$2,$3,$4)
    `, [
      r.employee_id,
      r.work_date,
      r.derived_status,
      r.regular_hours
    ]);
  }

  res.json({ message: "Approved" });
});


// 📊 عرض الجدول
router.get("/sheet", async (req, res) => {
  const { month, year } = req.query;

  const days = new Date(year, month, 0).getDate();

  const data = await query(`
    SELECT e.full_name, e.gas_id, a.*
    FROM attendance_records a
    JOIN employees e ON e.id = a.employee_id
    WHERE EXTRACT(MONTH FROM a.work_date) = $1
    AND EXTRACT(YEAR FROM a.work_date) = $2
  `, [month, year]);

  const map = {};

  data.rows.forEach(r => {
    if (!map[r.gas_id]) {
      map[r.gas_id] = {
        name: r.full_name,
        days: {}
      };
    }

    const d = new Date(r.work_date).getDate();

    map[r.gas_id].days[d] = r.status;
  });

  res.json({
    days,
    employees: Object.values(map)
  });
});

export default router;