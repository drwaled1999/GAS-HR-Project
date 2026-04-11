import express from "express";
import multer from "multer";
import ExcelJS from "exceljs";
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
    .replace(/\s+/g, " ");
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

  const parsed = new Date(String(value).trim());
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
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

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(req.file.path);

      const sheet = workbook.worksheets[0];
      if (!sheet) {
        return res.status(400).json({ message: "No worksheet found" });
      }

      const headerRow = sheet.getRow(1);
      const headers = headerRow.values.map(normalizeHeader);

      const gasIdIndex = headers.findIndex(h => h.includes("gas"));
      const nameIndex = headers.findIndex(h => h.includes("name"));
      const dateIndex = headers.findIndex(h => h.includes("date"));
      const regularHoursIndex = headers.findIndex(h => h.includes("regular"));
      const punchCountIndex = headers.findIndex(h => h.includes("punch count"));

      if (gasIdIndex === -1 || dateIndex === -1 || regularHoursIndex === -1) {
        return res.status(400).json({
          message: "Required columns not found. Need GAS ID, Date, Regular Hours."
        });
      }

      const unmatchedRows = [];
      let processedCount = 0;

      for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
        const row = sheet.getRow(rowNumber);

        const gasId = getCellValue(row.getCell(gasIdIndex));
        const employeeName = nameIndex !== -1 ? getCellValue(row.getCell(nameIndex)) : "";
        const workDate = excelDateToISO(row.getCell(dateIndex).value);
        const regularHoursRaw = getCellValue(row.getCell(regularHoursIndex));
        const punchCountRaw = punchCountIndex !== -1 ? getCellValue(row.getCell(punchCountIndex)) : "";

        if (!gasId || !workDate) continue;

        const regularHours = Number(regularHoursRaw || 0);
        const punchCount = Number(punchCountRaw || 0);

        let status = "A";
        let hours = 0;

        // إذا بصمة واحدة
        if (punchCount === 1) {
          status = "SP";
          hours = 0;
        }
        // إذا فيه ساعات من Regular Hours
        else if (!Number.isNaN(regularHours) && regularHours > 0) {
          status = String(regularHours);
          hours = regularHours;
        }
        // إذا فاضي
        else {
          status = "A";
          hours = 0;
        }

        const employeeRes = await query(
          `SELECT id, full_name, gas_id FROM employees WHERE gas_id = $1`,
          [gasId]
        );

        const employee = employeeRes.rows[0];

        // إذا الموظف غير موجود لا نرفضه، فقط نخزنه unmatched
        if (!employee) {
          unmatchedRows.push({
            gas_id: gasId,
            employee_name: employeeName,
            work_date: workDate,
            value: status
          });
          continue;
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
            employeeName ? `Imported from fingerprint file for ${employeeName}` : "Imported from fingerprint file"
          ]
        );

        processedCount++;
      }

      return res.json({
        ok: true,
        processedCount,
        unmatchedCount: unmatchedRows.length,
        unmatchedRows
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

    return res.json(result.rows);
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

      // إذا أدخل المسؤول رقم يدوي
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

    const daysInMonth = 31;
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

      for (let col = 6; col <= 36; col++) {
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
        } else if (["AL", "SL", "EL", "UL", "HL", "UM"].includes(value)) {
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

    sheet.columns.forEach(column => {
      column.width = 14;
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
