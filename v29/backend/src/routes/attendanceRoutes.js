import express from "express";
import multer from "multer";
import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import { query } from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permissions.js";

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
  if (typeof cell.value === "object" && cell.value.text) return String(cell.value.text).trim();
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

  if (!lines.length) return { headers: [], rows: [] };

  const headers = splitCsvLine(lines[0]).map(normalizeHeader);
  const rows = lines.slice(1).map((line) => splitCsvLine(line));

  return { headers, rows };
}

function detectIndexes(headers) {
  return {
    dateIndex: headers.findIndex(
      (h) =>
        h === "date" ||
        h.includes("transaction date") ||
        h.includes("work date")
    ),

    nameIndex: headers.findIndex(
      (h) =>
        h === "name" ||
        h.includes("employee name") ||
        h.includes("employee")
    ),

    gasIdIndex: headers.findIndex(
      (h) =>
        h === "user id" ||
        h === "userid" ||
        h.includes("user id") ||
        h.includes("gas id") ||
        h.includes("employee code") ||
        h.includes("emp code")
    ),

    regularHoursIndex: headers.findIndex(
      (h) =>
        h === "regular ho" ||
        h.includes("regular ho") ||
        h.includes("regular hours") ||
        h.includes("reg hours")
    ),

    totalWorkHoursIndex: headers.findIndex(
      (h) =>
        h === "total work hours" ||
        h.includes("total work hours")
    ),

    inIndex: headers.findIndex((h) => h === "in"),
    outIndex: headers.findIndex((h) => h === "out"),

    exceptionIndex: headers.findIndex(
      (h) =>
        h === "exception" ||
        h.includes("exception")
    )
  };
}

function parseTimeToHours(timeString) {
  if (!timeString) return 0;
  const raw = String(timeString).trim();
  if (!raw || raw === "-" || raw === "0:00:00") return 0;

  const parts = raw.split(":").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return 0;

  const [hours, minutes, seconds] = parts;
  return Number((hours + minutes / 60 + seconds / 3600).toFixed(2));
}

function hasSinglePunch(inValue, outValue, exceptionValue) {
  const hasIn = !!String(inValue || "").trim() && String(inValue || "").trim() !== "-";
  const hasOut = !!String(outValue || "").trim() && String(outValue || "").trim() !== "-";
  const exception = String(exceptionValue || "").toLowerCase();

  if ((hasIn && !hasOut) || (!hasIn && hasOut)) return true;
  if (exception.includes("insufficien")) return true;

  return false;
}

async function ensureEmployeeExists(gasId, employeeName) {
  const employeeRes = await query(
    `SELECT id, full_name, gas_id, nationality, status
     FROM employees
     WHERE gas_id = $1`,
    [gasId]
  );

  if (employeeRes.rows[0]) return employeeRes.rows[0];

  const newEmployee = {
    id: uuid(),
    full_name: employeeName || `Imported ${gasId}`,
    gas_id: gasId,
    nationality: "Unknown",
    project_name: null,
    package_name: null,
    status: "unmatched"
  };

  await query(
    `INSERT INTO employees
      (id, user_id, full_name, gas_id, nationality, project_name, package_name, status)
     VALUES ($1,NULL,$2,$3,$4,$5,$6,$7)`,
    [
      newEmployee.id,
      newEmployee.full_name,
      newEmployee.gas_id,
      newEmployee.nationality,
      newEmployee.project_name,
      newEmployee.package_name,
      newEmployee.status
    ]
  );

  return newEmployee;
}

async function processAttendanceRows(rawRows) {
  let processedCount = 0;
  const autoCreatedEmployees = [];

  for (const item of rawRows) {
    const {
      gasId,
      employeeName,
      workDate,
      regularHours,
      totalWorkHours,
      inValue,
      outValue,
      exceptionValue
    } = item;

    if (!gasId || !workDate) continue;

    const regularHoursNum = parseTimeToHours(regularHours);
    const totalWorkHoursNum = parseTimeToHours(totalWorkHours);

    let status = "A";
    let hours = 0;

    if (hasSinglePunch(inValue, outValue, exceptionValue)) {
      status = "SP";
      hours = 0;
    } else if (regularHoursNum > 0) {
      status = String(regularHoursNum);
      hours = regularHoursNum;
    } else if (totalWorkHoursNum > 0) {
      status = String(totalWorkHoursNum);
      hours = totalWorkHoursNum;
    } else {
      status = "A";
      hours = 0;
    }

    const employee = await ensureEmployeeExists(gasId, employeeName);

    if (employee.status === "unmatched") {
      autoCreatedEmployees.push({
        gas_id: gasId,
        employee_name: employeeName || employee.full_name
      });
    }

    await query(
      `INSERT INTO attendance_records
        (id, employee_id, work_date, hours, status, source, note)
       VALUES ($1,$2,$3,$4,$5,'fingerprint',$6)
       ON CONFLICT (employee_id, work_date)
       DO UPDATE SET
         hours = EXCLUDED.hours,
         status = EXCLUDED.status,
         source = 'fingerprint',
         note = EXCLUDED.note`,
      [
        uuid(),
        employee.id,
        workDate,
        hours,
        status,
        employeeName
          ? `Imported from fingerprint file for ${employeeName}`
          : "Imported from fingerprint file"
      ]
    );

    processedCount++;
  }

  return {
    processedCount,
    autoCreatedEmployees
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
          indexes.gasIdIndex === -1 ||
          indexes.dateIndex === -1 ||
          (indexes.regularHoursIndex === -1 && indexes.totalWorkHoursIndex === -1)
        ) {
          return res.status(400).json({
            message:
              "Missing required columns. Expected User ID/GAS ID, Date, and Regular ho or Total Work Hours."
          });
        }

        parsedRows = rows.map((row) => ({
          gasId: row[indexes.gasIdIndex] || "",
          employeeName: indexes.nameIndex !== -1 ? row[indexes.nameIndex] || "" : "",
          workDate: excelDateToISO(row[indexes.dateIndex]),
          regularHours: indexes.regularHoursIndex !== -1 ? row[indexes.regularHoursIndex] || "" : "",
          totalWorkHours:
            indexes.totalWorkHoursIndex !== -1 ? row[indexes.totalWorkHoursIndex] || "" : "",
          inValue: indexes.inIndex !== -1 ? row[indexes.inIndex] || "" : "",
          outValue: indexes.outIndex !== -1 ? row[indexes.outIndex] || "" : "",
          exceptionValue:
            indexes.exceptionIndex !== -1 ? row[indexes.exceptionIndex] || "" : ""
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
          indexes.gasIdIndex === -1 ||
          indexes.dateIndex === -1 ||
          (indexes.regularHoursIndex === -1 && indexes.totalWorkHoursIndex === -1)
        ) {
          return res.status(400).json({
            message:
              "Missing required columns. Expected User ID/GAS ID, Date, and Regular ho or Total Work Hours."
          });
        }

        for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
          const row = sheet.getRow(rowNumber);

          parsedRows.push({
            gasId: getCellValue(row.getCell(indexes.gasIdIndex)),
            employeeName: indexes.nameIndex !== -1 ? getCellValue(row.getCell(indexes.nameIndex)) : "",
            workDate: excelDateToISO(row.getCell(indexes.dateIndex).value),
            regularHours:
              indexes.regularHoursIndex !== -1
                ? getCellValue(row.getCell(indexes.regularHoursIndex))
                : "",
            totalWorkHours:
              indexes.totalWorkHoursIndex !== -1
                ? getCellValue(row.getCell(indexes.totalWorkHoursIndex))
                : "",
            inValue: indexes.inIndex !== -1 ? getCellValue(row.getCell(indexes.inIndex)) : "",
            outValue: indexes.outIndex !== -1 ? getCellValue(row.getCell(indexes.outIndex)) : "",
            exceptionValue:
              indexes.exceptionIndex !== -1
                ? getCellValue(row.getCell(indexes.exceptionIndex))
                : ""
          });
        }
      }

      const result = await processAttendanceRows(parsedRows);

      return res.json({
        ok: true,
        processedCount: result.processedCount,
        autoCreatedEmployees: result.autoCreatedEmployees
      });
    } catch (error) {
      console.error("Attendance upload error:", error);
      return res.status(500).json({ message: "Failed to import attendance file" });
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
          a.status,
          a.source
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
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFFC7CE" }
          };
        } else if (value === "SP") {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF4B183" }
          };
        } else if (["V", "SL", "EL", "UL", "HL", "UM"].includes(value)) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFD9E2F3" }
          };
        } else if (["H", "NH", "W"].includes(value)) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFE7E6E6" }
          };
        } else if (!Number.isNaN(Number(value))) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFE2F0D9" }
          };
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
