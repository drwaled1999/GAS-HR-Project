import express from "express";
import multer from "multer";
import pkg from "csv-parse";
import { query } from "../data/index.js";

const { parse } = pkg;

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    console.log("Starting CSV upload...");

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const { month, year } = req.body;

    // ✅ إنشاء batch
    const batchRes = await query(
      `INSERT INTO attendance_import_batches (file_name, month_int, year_int)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [req.file.originalname, month, year]
    );

    const importBatchId = batchRes.rows[0].id;

    // ✅ قراءة CSV
    const records = [];

    await new Promise((resolve, reject) => {
      parse(
        req.file.buffer.toString(),
        { columns: true, skip_empty_lines: true },
        (err, output) => {
          if (err) reject(err);
          records.push(...output);
          resolve();
        }
      );
    });

    console.log("CSV Rows:", records.length);

    // ✅ جلب الموظفين وربطهم بـ gas_id
    const employeesRes = await query(`SELECT id, gas_id FROM employees`);

    const employeeMap = new Map();

    for (const emp of employeesRes.rows) {
      if (emp.gas_id) {
        employeeMap.set(String(emp.gas_id).trim(), emp.id);
      }
    }

    console.log("Employees loaded:", employeeMap.size);

    // ✅ إدخال البيانات
    for (const row of records) {
      const gasId = String(row["User ID"] || "").trim();
      const employeeName = row["Name"] || "";

      // 📅 تاريخ
      const workDate = row["Date"]
        ? new Date(row["Date"])
        : new Date();

      const regularHours = Number(row["Hours"] || 0);

      // 🔥 الربط الذكي
      let employeeUuid = employeeMap.get(gasId) || null;

      // 🚨 حماية UUID
      if (!employeeUuid || typeof employeeUuid !== "string" || !employeeUuid.includes("-")) {
        employeeUuid = null;
      }

      console.log("LINK:", gasId, "=>", employeeUuid);

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
        VALUES ($1, $2::uuid, $3, $4, $5, $6, $7, $8::jsonb)
        `,
        [
          importBatchId,
          employeeUuid,
          gasId,
          employeeName,
          workDate,
          regularHours,
          regularHours > 0 ? "P" : "A",
          JSON.stringify(row),
        ]
      );
    }

    console.log("Upload finished");

    return res.json({
      message: "File uploaded successfully",
      batchId: importBatchId,
    });

  } catch (error) {
    console.error("Attendance upload fatal error:", error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
