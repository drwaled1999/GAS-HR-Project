import express from "express";
import multer from "multer";
import csv from "csv-parser";
import fs from "fs";
import { query } from "../data/index.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

/**
 * رفع ملف البصمة CSV
 */
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const { month, year } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    console.log("📥 Starting CSV upload...");

    // 1️⃣ إنشاء Batch
    const batchResult = await query(
      `
      INSERT INTO attendance_import_batches (file_name, month_int, year_int)
      VALUES ($1, $2, $3)
      RETURNING id
      `,
      [req.file.originalname, month, year]
    );

    const importBatchId = batchResult.rows[0].id;

    // 2️⃣ قراءة الموظفين وربط gas_id → UUID
    const employees = await query(`
      SELECT id, gas_id FROM employees
      WHERE gas_id IS NOT NULL
    `);

    const employeeMap = new Map();
    employees.rows.forEach(emp => {
      employeeMap.set(emp.gas_id, emp.id);
    });

    const results = [];

    // 3️⃣ قراءة CSV
    await new Promise((resolve, reject) => {
      fs.createReadStream(req.file.path)
        .pipe(csv())
        .on("data", (data) => {
          results.push(data);
        })
        .on("end", resolve)
        .on("error", reject);
    });

    console.log("📊 CSV Rows:", results.length);

    // 4️⃣ إدخال البيانات
    for (const row of results) {
      try {
        const gasId = row["User ID"] || row["UserID"] || row["user_id"];
        const name = row["Name"] || null;
        const date = row["Date"];
        const hours = parseFloat(row["Regular hours"] || 0);

        if (!gasId || !date) continue;

        const employeeUuid = employeeMap.get(gasId) || null;

        console.log("DEBUG:", {
          gasId,
          employeeUuid,
          name,
          date,
        });

        await query(
          `
          INSERT INTO attendance_import_rows
          (
            import_batch_id,
            employee_id,
            gas_id,
            employee_name,
            work_date,
            regular_hours,
            derived_status,
            raw_json
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `,
          [
            importBatchId,
            employeeUuid,     // ✅ UUID صحيح أو null
            gasId,            // ✅ رقم الجهاز
            name,
            date,
            hours,
            hours > 0 ? "P" : "A",
            JSON.stringify(row)
          ]
        );

      } catch (err) {
        console.error("❌ Row insert error:", err.message);
      }
    }

    // حذف الملف
    fs.unlinkSync(req.file.path);

    console.log("✅ Upload finished");

    res.json({
      success: true,
      message: "File uploaded successfully",
      batchId: importBatchId,
    });

  } catch (error) {
    console.error("🔥 Attendance upload fatal error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * اعتماد البيانات (Approve)
 */
router.post("/approve/:batchId", async (req, res) => {
  try {
    const { batchId } = req.params;

    // جلب البيانات
    const rows = await query(
      `
      SELECT * FROM attendance_import_rows
      WHERE import_batch_id = $1
      `,
      [batchId]
    );

    for (const row of rows.rows) {
      if (!row.employee_id) continue;

      await query(
        `
        INSERT INTO attendance_records
        (employee_id, work_date, status, hours, source_batch_id)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (employee_id, work_date)
        DO UPDATE SET
          status = EXCLUDED.status,
          hours = EXCLUDED.hours
        `,
        [
          row.employee_id,
          row.work_date,
          row.derived_status,
          row.regular_hours,
          batchId,
        ]
      );
    }

    await query(
      `
      UPDATE attendance_import_batches
      SET status = 'approved',
          approved_at = NOW()
      WHERE id = $1
      `,
      [batchId]
    );

    res.json({ success: true });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
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
          ir.id AS row_id,
          ir.employee_id,
          ir.employee_name,
          ir.gas_id,
          ir.work_date,
          ir.regular_hours,
          ir.derived_status,
          ir.status_override,
          e.nationality,
          e.job_title,
          e.gas_id AS employee_gas_id,
          e.full_name AS employee_full_name
        FROM attendance_import_rows ir
        LEFT JOIN employees e ON e.id = ir.employee_id
        WHERE ir.import_batch_id = $1
        ORDER BY COALESCE(e.full_name, ir.employee_name) ASC, ir.work_date ASC
        `,
        [batchId]
      );
    } else {
      rowsRes = await query(
        `
        SELECT
          NULL::INT AS row_id,
          a.employee_id,
          e.full_name AS employee_name,
          e.gas_id,
          a.work_date,
          a.hours AS regular_hours,
          a.status AS derived_status,
          NULL::TEXT AS status_override,
          e.nationality,
          e.job_title,
          e.gas_id AS employee_gas_id,
          e.full_name AS employee_full_name
        FROM attendance_records a
        LEFT JOIN employees e ON e.id = a.employee_id
        WHERE EXTRACT(MONTH FROM a.work_date) = $1
          AND EXTRACT(YEAR FROM a.work_date) = $2
        ORDER BY e.full_name ASC, a.work_date ASC
        `,
        [month, year]
      );
    }

    const grouped = new Map();

    for (const row of rowsRes.rows) {
      const key = `${row.employee_gas_id || row.gas_id || row.employee_id || row.employee_name}`;

      if (!grouped.has(key)) {
        grouped.set(key, {
          sno: grouped.size + 1,
          rowGroupKey: key,
          name: row.employee_full_name || row.employee_name || "",
          tradeCategory: row.job_title || "",
          id: row.employee_id || "",
          gasId: row.employee_gas_id || row.gas_id || "",
          nationality: row.nationality || "",
          days: {},
        });
      }

      const item = grouped.get(key);
      const dateObj = new Date(row.work_date);
      const dayNumber = dateObj.getDate();
      const finalStatus = row.status_override || row.derived_status || "A";

      item.days[dayNumber] = {
        rowId: row.row_id,
        value: finalStatus,
        regularHours: Number(row.regular_hours || 0),
      };
    }

    const employees = Array.from(grouped.values()).map((employee) => {
      const filledDays = {};

      for (let d = 1; d <= daysInMonth; d += 1) {
        filledDays[d] =
          employee.days[d] || {
            rowId: null,
            value: "A",
            regularHours: 0,
          };
      }

      return {
        ...employee,
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