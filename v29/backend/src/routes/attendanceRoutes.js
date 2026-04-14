import express from "express";
import multer from "multer";
import { parse } from "csv-parse/sync";
import { query } from "../data/index.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
});

router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    console.log("=== Upload started ===");

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // قراءة الملف
    const text = req.file.buffer.toString("utf8");

    const records = parse(text, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    console.log("Rows:", records.length);

    if (!records.length) {
      return res.status(400).json({ message: "CSV empty" });
    }

    // إنشاء batch
    const batchResult = await query(
      `
      INSERT INTO attendance_import_batches 
      (file_name, month_int, year_int, status)
      VALUES ($1, $2, $3, 'pending')
      RETURNING id
      `,
      [
        req.file.originalname,
        Number(req.body.month),
        Number(req.body.year),
      ]
    );

    const batchId = batchResult.rows[0].id;

    let saved = 0;

    for (const row of records) {
      try {
        // 👇 عدل حسب ملفك
        const gasId =
          row["User ID"] ||
          row["user_id"] ||
          row["USERID"] ||
          null;

        const name =
          row["Name"] ||
          row["NAME"] ||
          row["Employee Name"] ||
          null;

        const regularHours =
          Number(row["Regular Hours"]) ||
          Number(row["REGULAR HOURS"]) ||
          0;

        const date =
          row["Date"] ||
          row["DATE"] ||
          row["Work Date"];

        if (!gasId || !name || !date) continue;

        await query(
          `
          INSERT INTO attendance_import_rows
          (batch_id, gas_id, employee_name, work_date, regular_hours, raw_json)
          VALUES ($1, $2, $3, $4, $5, $6)
          `,
          [
            batchId,
            gasId,
            name,
            date,
            regularHours,
            JSON.stringify(row),
          ]
        );

        saved++;
      } catch (err) {
        console.log("Row error:", err.message);
      }
    }

    console.log("Saved:", saved);

    res.json({
      message: "Upload done",
      batchId,
      saved,
    });
  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    res.status(500).json({
      message: err.message,
    });
  }
});

export default router;