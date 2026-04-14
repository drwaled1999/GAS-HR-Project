import express from "express";
import multer from "multer";
import { parse } from "csv-parse/sync";
import { query } from "../data/index.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

function parseHours(value) {
  if (!value || value === "-" || value === "0" || value === "0:00" || value === "0:00:00") {
    return 0;
  }

  const parts = String(value).split(":").map(Number);
  if (parts.length < 2 || Number.isNaN(parts[0])) return 0;

  const h = parts[0] || 0;
  const m = parts[1] || 0;
  const s = parts[2] || 0;

  return Math.round((h + m / 60 + s / 3600) * 100) / 100;
}

function normalizeDate(value) {
  if (!value) return null;

  const str = String(value).trim();
  const direct = new Date(str);
  if (!Number.isNaN(direct.getTime())) return direct;

  const slashParts = str.split("/");
  if (slashParts.length === 3) {
    const a = Number(slashParts[0]);
    const b = Number(slashParts[1]);
    const c = Number(slashParts[2]);

    if (a > 0 && a <= 12 && b > 0 && b <= 31 && c > 1900) {
      const parsed = new Date(c, a - 1, b, 12, 0, 0);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }

    if (a > 0 && a <= 31 && b > 0 && b <= 12 && c > 1900) {
      const parsed = new Date(c, b - 1, a, 12, 0, 0);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
  }

  const dashParts = str.split("-");
  if (dashParts.length === 3) {
    const yyyy = Number(dashParts[0]);
    const mm = Number(dashParts[1]);
    const dd = Number(dashParts[2]);

    const parsed = new Date(yyyy, mm - 1, dd, 12, 0, 0);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  return null;
}

function toLocalDateKey(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function buildAttendanceState(records) {
  if (!records || !records.length) {
    return { days: [], rows: [], monthTitle: "Attendance" };
  }

  const employeesMap = {};
  const datesMap = {};

  records.forEach((row) => {
    const name = String(row["Name"] || row["Employee"] || "").trim();
    const userId = String(row["User ID"] || row["UserID"] || row["ID"] || "").trim();
    const dateObj = normalizeDate(row["Date"]);

    if (!name || !dateObj) return;

    const dateKey = toLocalDateKey(dateObj);
    datesMap[dateKey] = dateObj;

    if (!employeesMap[name]) {
      employeesMap[name] = {
        name,
        userId,
        byDay: {},
        totalHours: 0,
        absentCount: 0,
        singlePunchCount: 0,
      };
    }

    const exception = String(row["Exception"] || "").trim();
    const leave = String(row["Leave"] || "").trim();
    const totalHours = parseHours(
      row["Regular hours"] ||
      row["Regular Hours"] ||
      row["Total Work Hours"] ||
      row["Total work hours"]
    );
    const inTime = String(row["In"] || "").trim();
    const outTime = String(row["Out"] || "").trim();

    let cell = { value: "", type: "normal" };

    if (leave && leave !== "-" && leave !== "--") {
      cell = { value: leave, type: "leave" };
    } else if (/absence/i.test(exception)) {
      cell = { value: "A", type: "absent" };
      employeesMap[name].absentCount += 1;
    } else if (
      /missing punch/i.test(exception) ||
      (inTime && inTime !== "-" && (!outTime || outTime === "-")) ||
      (outTime && outTime !== "-" && (!inTime || inTime === "-"))
    ) {
      cell = {
        value: totalHours > 0 ? String(Math.round(totalHours)) : "",
        type: "single",
      };
      employeesMap[name].singlePunchCount += 1;
      employeesMap[name].totalHours += totalHours;
    } else if (totalHours > 0) {
      cell = { value: String(Math.round(totalHours)), type: "hours" };
      employeesMap[name].totalHours += totalHours;
    }

    employeesMap[name].byDay[dateKey] = cell;
  });

  const days = Object.keys(datesMap)
    .sort()
    .map((dateKey) => {
      const d = datesMap[dateKey];
      return {
        key: dateKey,
        label: `${d.getDate()}-${d.toLocaleString("en-US", { month: "short" })}`,
        weekend: d.getDay() === 5 || d.getDay() === 6,
      };
    });

  const rows = Object.values(employeesMap).map((emp) => {
    const cells = days.map((day) => {
      const existing = emp.byDay[day.key];
      if (existing) return existing;
      if (day.weekend) return { value: "", type: "weekend" };

      emp.absentCount += 1;
      return { value: "A", type: "absent" };
    });

    return {
      ...emp,
      cells,
      totalHours: Math.round(emp.totalHours * 100) / 100,
    };
  });

  const firstDay = days[0]?.key ? normalizeDate(days[0].key) : null;
  const monthTitle = firstDay
    ? `${firstDay.toLocaleString("en-US", { month: "long" })} Attendance`
    : "Attendance";

  return { days, rows, monthTitle };
}

router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const { month, year } = req.body;

    const batchRes = await query(
      `INSERT INTO attendance_import_batches (file_name, month_int, year_int)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [req.file.originalname, month || null, year || null]
    );

    const importBatchId = batchRes.rows[0].id;

    const records = parse(req.file.buffer.toString("utf-8"), {
      columns: true,
      skip_empty_lines: true,
      bom: true,
    });

    const parsedState = buildAttendanceState(records);

    for (const record of records) {
      const employeeCode = String(
        record["User ID"] || record["UserID"] || record["ID"] || ""
      ).trim();

      const employeeName = String(
        record["Name"] || record["Employee"] || ""
      ).trim();

      const dateObj = normalizeDate(record["Date"]);
      if (!employeeName || !dateObj) continue;

      const workDate = toLocalDateKey(dateObj);
      const checkIn = String(record["In"] || "").trim() || null;
      const checkOut = String(record["Out"] || "").trim() || null;
      const regularHours = parseHours(
        record["Regular hours"] ||
        record["Regular Hours"] ||
        record["Total Work Hours"] ||
        record["Total work hours"]
      );
      const exceptionText = String(record["Exception"] || "").trim() || null;
      const leaveText = String(record["Leave"] || "").trim() || null;

      await query(
        `INSERT INTO attendance_records
         (import_batch_id, employee_code, employee_name, work_date, check_in, check_out, regular_hours, exception_text, leave_text)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          importBatchId,
          employeeCode,
          employeeName,
          workDate,
          checkIn,
          checkOut,
          regularHours,
          exceptionText,
          leaveText,
        ]
      );
    }

    return res.status(200).json({
      message: "Attendance CSV uploaded successfully",
      batchId: importBatchId,
      data: parsedState,
    });
  } catch (error) {
    console.error("Attendance upload error:", error);
    return res.status(500).json({
      message: "Failed to upload attendance CSV",
      error: error.message,
    });
  }
});

router.get("/batch/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const batchRes = await query(
      `SELECT * FROM attendance_import_batches WHERE id = $1`,
      [id]
    );

    if (batchRes.rows.length === 0) {
      return res.status(404).json({ message: "Batch not found" });
    }

    const recordsRes = await query(
      `SELECT * FROM attendance_records
       WHERE import_batch_id = $1
       ORDER BY employee_name ASC, work_date ASC`,
      [id]
    );

    const transformed = recordsRes.rows.map((row) => ({
      Name: row.employee_name,
      "User ID": row.employee_code,
      Date: row.work_date,
      In: row.check_in,
      Out: row.check_out,
      "Regular hours": row.regular_hours,
      Exception: row.exception_text,
      Leave: row.leave_text,
    }));

    const parsedState = buildAttendanceState(transformed);

    return res.status(200).json({
      batch: batchRes.rows[0],
      data: parsedState,
    });
  } catch (error) {
    console.error("Get attendance batch error:", error);
    return res.status(500).json({
      message: "Failed to load attendance batch",
      error: error.message,
    });
  }
});

export default router;
