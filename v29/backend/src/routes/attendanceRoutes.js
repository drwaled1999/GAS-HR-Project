import express from "express";
import multer from "multer";
import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import { query } from "../data/index.js";
import { requireAuth } from "../utils/middleware_auth.js";
import { requirePermission } from "../utils/permissions.js";

const router = express.Router();
const upload = multer({ dest: "uploads/temp" });

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[_-]/g, " ");
}

function getCellValue(cell) {
  if (!cell) return "";
  if (cell.value == null) return "";
  if (typeof cell.value === "object" && cell.value.text) {
    return String(cell.value.text).trim();
  }
  return String(cell.value).trim();
}

function excelDateToISO(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  const raw = String(value).trim();
  const parsed = new Date(raw);

  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
}

function splitCsvLine(line) {
  const result = [];
  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (ch === "," && !insideQuotes) {
      result.push(current);
      current = "";
      continue;
    }

    current += ch;
  }

  result.push(current);
  return result.map((v) => v.trim());
}

async function readCsvFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return { headers: [], rows: [] };
  }

  const headers = splitCsvLine(lines[0]).map(normalizeHeader);
  const rows = lines.slice(1).map((line) => splitCsvLine(line));

  return { headers, rows };
}

function detectIndexes(headers) {
  return {
    dateIndex: headers.findIndex((h) => h === "date" || h.includes("date")),
    nameIndex: headers.findIndex((h) => h === "name" || h.includes("name")),
    userIdIndex: headers.findIndex(
      (h) => h === "user id" || h === "userid" || h.includes("user id")
    ),
    regularHoursIndex: headers.findIndex(
      (h) =>
        h === "regular hours" ||
        h === "regular ho" ||
        h.includes("regular hours") ||
        h.includes("regular ho") ||
        h.includes("regular h")
    )
  };
}

function parseRegularHours(value) {
  const raw = String(value || "").trim();
  if (!raw || raw === "-" || raw === "0:00:00") return 0;

  if (/^\d+(\.\d+)?$/.test(raw)) {
    return Number(raw);
  }

  const parts = raw.split(":").map(Number);
  if (parts.length === 3 && parts.every((n) => !Number.isNaN(n))) {
    const [hours, minutes, seconds] = parts;
    return Number((hours + minutes / 60 + seconds / 3600).toFixed(2));
  }

  return 0;
}

async function stageImportRows(rows) {
  const importBatchId = uuid();
  let stagedCount = 0;
  const matchedPreview = [];
  const unmatchedPreview = [];

  for (const row of rows) {
    const { userIdValue, employeeName, workDate, regularHours } = row;
    if (!userIdValue || !workDate) continue;

    const normalizedHours = parseRegularHours(regularHours);
    const status = normalizedHours > 0 ? String(normalizedHours) : "A";

    const employeeRes = await query(
      `SELECT id, full_name, gas_id
       FROM employees
       WHERE gas_id = $1
       LIMIT 1`,
      [userIdValue]
    );

    const matchedEmployee = employeeRes.rows[0] || null;

    await query(
      `INSERT INTO attendance_import_rows
        (id, import_batch_id, user_id_value, employee_name, work_date, regular_hours, status, matched_employee_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        uuid(),
        importBatchId,
        userIdValue,
        employeeName || "",
        workDate,
        normalizedHours,
        status,
        matchedEmployee?.id || null
      ]
    );

    stagedCount++;

    if (matchedEmployee) {
      matchedPreview.push({
        user_id: userIdValue,
        name_from_file: employeeName || "",
        matched_employee: matchedEmployee.full_name,
        gas_id: matchedEmployee.gas_id,
        date: workDate,
        value: status
      });
    } else {
      unmatchedPreview.push({
        user_id: userIdValue,
        name_from_file: employeeName || "",
        date: workDate,
        value: status
      });
    }
  }

  return {
    importBatchId,
    stagedCount,
    matchedPreview,
    unmatchedPreview
  };
}

router.post(
  "/upload",
  requireAuth,
  requirePermission("upload_fingerprint"),
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const fileExt = path.extname(req.file.originalname).toLowerCase();
      let parsedRows = [];

      if (fileExt === ".csv") {
        const { headers, rows } = await readCsvFile(req.file.path);
        const indexes = detectIndexes(headers);

        if (
          indexes.dateIndex === -1 ||
          indexes.nameIndex === -1 ||
          indexes.userIdIndex === -1 ||
          indexes.regularHoursIndex === -1
        ) {
          return res.status(400).json({
            message: "Missing required columns: Date, Name, User ID, Regular Hours."
          });
        }

        parsedRows = rows.map((row) => ({
          workDate: excelDateToISO(row[indexes.dateIndex]),
          employeeName: row[indexes.nameIndex] || "",
          userIdValue: row[indexes.userIdIndex] || "",
          regularHours: row[indexes.regularHoursIndex] || ""
        }));
      } else {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(req.file.path);

        const sheet = workbook.worksheets[0];
        if (!sheet) {
          return res.status(400).json({ message: "No worksheet found" });
        }

        const headers = sheet.getRow(1).values.map(normalizeHeader);
        const indexes = detectIndexes(headers);

        if (
          indexes.dateIndex === -1 ||
          indexes.nameIndex === -1 ||
          indexes.userIdIndex === -1 ||
          indexes.regularHoursIndex === -1
        ) {
          return res.status(400).json({
            message: "Missing required columns: Date, Name, User ID, Regular Hours."
          });
        }

        for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
          const row = sheet.getRow(rowNumber);
          parsedRows.push({
            workDate: excelDateToISO(row.getCell(indexes.dateIndex).value),
            employeeName: getCellValue(row.getCell(indexes.nameIndex)),
            userIdValue: getCellValue(row.getCell(indexes.userIdIndex)),
            regularHours: getCellValue(row.getCell(indexes.regularHoursIndex))
          });
        }
      }

      const result = await stageImportRows(parsedRows);

      return res.json({
        ok: true,
        importBatchId: result.importBatchId,
        stagedCount: result.stagedCount,
        matchedPreview: result.matchedPreview.slice(0, 20),
        unmatchedPreview: result.unmatchedPreview.slice(0, 20)
      });
    } catch (error) {
      console.error("Attendance upload error:", error);
      return res.status(500).json({ message: "Failed to import attendance file" });
    }
  }
);

router.get(
  "/imports/:batchId",
  requireAuth,
  requirePermission("view_attendance"),
  async (req, res) => {
    try {
      const result = await query(
        `SELECT
          air.id,
          air.import_batch_id,
          air.user_id_value,
          air.employee_name,
          air.work_date,
          air.regular_hours,
          air.status,
          air.is_approved,
          air.matched_employee_id,
          e.full_name as matched_employee_name,
          e.gas_id as matched_gas_id
         FROM attendance_import_rows air
         LEFT JOIN employees e ON e.id = air.matched_employee_id
         WHERE air.import_batch_id = $1
         ORDER BY air.employee_name, air.work_date`,
        [req.params.batchId]
      );

      return res.json({ rows: result.rows });
    } catch (error) {
      console.error("Attendance imports fetch error:", error);
      return res.status(500).json({ message: "Failed to load import rows" });
    }
  }
);

router.post(
  "/imports/:batchId/approve",
  requireAuth,
  requirePermission("edit_attendance"),
  async (req, res) => {
    try {
      const { onlyMatched = true } = req.body || {};

      const importRowsRes = await query(
        `SELECT *
         FROM attendance_import_rows
         WHERE import_batch_id = $1
           AND is_approved = FALSE
           AND ($2::boolean = FALSE OR matched_employee_id IS NOT NULL)
         ORDER BY work_date`,
        [req.params.batchId, onlyMatched]
      );

      let approvedCount = 0;

      for (const row of importRowsRes.rows) {
        if (!row.matched_employee_id) continue;

        await query(
          `INSERT INTO attendance_records
            (id, employee_id, work_date, hours, status, source, note, modified_by)
           VALUES ($1,$2,$3,$4,$5,'fingerprint',$6,$7)
           ON CONFLICT (employee_id, work_date)
           DO UPDATE SET
             hours = EXCLUDED.hours,
             status = EXCLUDED.status,
             source = 'fingerprint',
             note = EXCLUDED.note,
             modified_by = EXCLUDED.modified_by`,
          [
            uuid(),
            row.matched_employee_id,
            row.work_date,
            Number(row.regular_hours || 0),
            row.status,
            `Approved from biometric import batch ${row.import_batch_id}`,
            req.user.id
          ]
        );

        await query(
          `UPDATE attendance_import_rows
           SET is_approved = TRUE,
               approved_by = $1,
               approved_at = NOW()
           WHERE id = $2`,
          [req.user.id, row.id]
        );

        approvedCount++;
      }

      return res.json({ ok: true, approvedCount });
    } catch (error) {
      console.error("Attendance approve error:", error);
      return res.status(500).json({ message: "Failed to approve import batch" });
    }
  }
);

router.get("/monthly", requireAuth, async (req, res) => {
  try {
    const { month, year } = req.query;

    const result = await query(
      `SELECT
          e.id as employee_id,
          e.full_name,
          e.gas_id,
          e.nationality,
          e.project_name,
          e.package_name,
          a.work_date,
          a.hours,
          a.status
       FROM attendance_records a
       JOIN employees e ON e.id = a.employee_id
       WHERE EXTRACT(MONTH FROM a.work_date) = $1
         AND EXTRACT(YEAR FROM a.work_date) = $2
       ORDER BY e.full_name, a.work_date`,
      [month, year]
    );

    return res.json({ rows: result.rows });
  } catch (error) {
    console.error("Monthly attendance error:", error);
    return res.status(500).json({ message: "Failed to load monthly attendance" });
  }
});

router.post(
  "/adjust",
  requireAuth,
  requirePermission("edit_attendance"),
  async (req, res) => {
    try {
      const { employeeId, workDate, status, hours, note } = req.body;

      let finalStatus = status;
      let finalHours = Number(hours || 0);

      if (status && !Number.isNaN(Number(status))) {
        finalStatus = String(Number(status));
        finalHours = Number(status);
      }

      await query(
        `INSERT INTO attendance_records
          (id, employee_id, work_date, hours, status, source, note, modified_by)
         VALUES ($1,$2,$3,$4,$5,'manual',$6,$7)
         ON CONFLICT (employee_id, work_date)
         DO UPDATE SET
           hours = EXCLUDED.hours,
           status = EXCLUDED.status,
           source = 'manual',
           note = EXCLUDED.note,
           modified_by = EXCLUDED.modified_by`,
        [
          uuid(),
          employeeId,
          workDate,
          finalHours,
          finalStatus,
          note || null,
          req.user.id
        ]
      );

      return res.json({ ok: true });
    } catch (error) {
      console.error("Attendance adjust error:", error);
      return res.status(500).json({ message: "Failed to update attendance record" });
    }
  }
);

router.get("/export", requireAuth, async (req, res) => {
  try {
    const { month, year } = req.query;

    const result = await query(
      `SELECT
          e.full_name,
          e.gas_id,
          e.nationality,
          e.project_name,
          e.package_name,
          a.work_date,
          a.status
       FROM attendance_records a
       JOIN employees e ON e.id = a.employee_id
       WHERE EXTRACT(MONTH FROM a.work_date) = $1
         AND EXTRACT(YEAR FROM a.work_date) = $2
       ORDER BY e.full_name, a.work_date`,
      [month, year]
    );

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Attendance Sheet");

    const employeeMap = new Map();

    for (const row of result.rows) {
      const key = row.gas_id;
      if (!employeeMap.has(key)) {
        employeeMap.set(key, {
          name: row.full_name,
          gasId: row.gas_id,
          nationality: row.nationality,
          project: row.project_name,
          package: row.package_name,
          days: {}
        });
      }

      const day = new Date(row.work_date).getDate();
      employeeMap.get(key).days[day] = row.status;
    }

    const daysInMonth = new Date(Number(year), Number(month), 0).getDate();
    const header = ["Name", "GAS ID", "Nationality", "Project", "Package"];

    for (let day = 1; day <= daysInMonth; day++) {
      header.push(String(day));
    }

    sheet.addRow(header);

    for (const employee of employeeMap.values()) {
      const row = [
        employee.name,
        employee.gasId,
        employee.nationality,
        employee.project || "",
        employee.package || ""
      ];

      for (let day = 1; day <= daysInMonth; day++) {
        row.push(employee.days[day] || "A");
      }

      sheet.addRow(row);
    }

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.alignment = { vertical: "middle", horizontal: "center" };

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      for (let col = 6; col <= 5 + daysInMonth; col++) {
        const cell = row.getCell(col);
        const value = String(cell.value || "");

        if (value === "A") {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFC7CE" } };
        } else if (value === "SP") {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF4B183" } };
        } else if (!Number.isNaN(Number(value))) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2F0D9" } };
        }

        cell.alignment = { vertical: "middle", horizontal: "center" };
      }
    });

    sheet.columns.forEach((column, index) => {
      column.width = index < 5 ? 16 : 8;
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=attendance-sheet-${month}-${year}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Attendance export error:", error);
    return res.status(500).json({ message: "Failed to export attendance sheet" });
  }
});

export default router;
