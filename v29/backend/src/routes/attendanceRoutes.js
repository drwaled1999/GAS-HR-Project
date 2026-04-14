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

export default router;