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

function mapOverrideToCell(type, row) {
  switch (type) {
    case "present":
      return {
        value: Number(row.regular_hours) > 0 ? String(Math.round(Number(row.regular_hours))) : "P",
        type: "hours",
      };
    case "takleef":
      return { value: "TK", type: "takleef" };
    case "annual_leave":
      return { value: "AL", type: "leave" };
    case "sick_leave":
      return { value: "SL", type: "sick" };
    case "permission":
      return { value: "PM", type: "permission" };
    case "absent":
      return { value: "A", type: "absent" };
    case "weekend":
      return { value: "", type: "weekend" };
    default:
      return null;
  }
}

function buildAttendanceStateFromDbRows(records) {
  if (!records || !records.length) {
    return { days: [], rows: [], monthTitle: "Attendance" };
  }

  const employeesMap = {};
  const datesMap = {};

  records.forEach((row) => {
    const name = String(row.employee_name || "").trim();
    const userId = String(row.employee_code || "").trim();
    const dateObj = normalizeDate(row.work_date);

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
        annualLeaveCount: 0,
        sickLeaveCount: 0,
        permissionCount: 0,
        takleefCount: 0,
      };
    }

    let cell = null;

    if (row.override_type) {
      cell = mapOverrideToCell(row.override_type, row);

      if (row.override_type === "absent") employeesMap[name].absentCount += 1;
      if (row.override_type === "annual_leave") employeesMap[name].annualLeaveCount += 1;
      if (row.override_type === "sick_leave") employeesMap[name].sickLeaveCount += 1;
      if (row.override_type === "permission") employeesMap[name].permissionCount += 1;
      if (row.override_type === "takleef") employeesMap[name].takleefCount += 1;
      if (row.override_type === "present" && Number(row.regular_hours) > 0) {
        employeesMap[name].totalHours += Number(row.regular_hours);
      }
    } else {
      const exception = String(row.exception_text || "").trim();
      const leave = String(row.leave_text || "").trim();
      const totalHours = Number(row.regular_hours || 0);
      const inTime = String(row.check_in || "").trim();
      const outTime = String(row.check_out || "").trim();

      cell = { value: "", type: "normal" };

      if (leave && leave !== "-" && leave !== "--") {
        cell = { value: leave, type: "leave" };
        employeesMap[name].annualLeaveCount += 1;
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
    }

    employeesMap[name].byDay[dateKey] = {
      ...cell,
      rowId: row.id,
      overrideType: row.override_type || "",
      overrideNote: row.override_note || "",
    };
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
      return {
        value: "A",
        type: "absent",
        rowId: null,
        overrideType: "",
        overrideNote: "",
      };
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

    const { month, year, username } = req.body;

    const batchRes = await query(
      `INSERT INTO attendance_import_batches
       (file_name, month_int, year_int, status, visible_to_employees)
       VALUES ($1, $2, $3, 'draft', false)
       RETURNING id`,
      [req.file.originalname, month || null, year || null]
    );

    const importBatchId = batchRes.rows[0].id;

    const records = parse(req.file.buffer.toString("utf-8"), {
      columns: true,
      skip_empty_lines: true,
      bom: true,
    });

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
         (import_batch_id, employee_code, employee_name, work_date, check_in, check_out, regular_hours, exception_text, leave_text, updated_by, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
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
          username || "system",
        ]
      );
    }

    const sheetRows = await query(
      `SELECT * FROM attendance_records
       WHERE import_batch_id = $1
       ORDER BY employee_name ASC, work_date ASC`,
      [importBatchId]
    );

    return res.status(200).json({
      message: "Attendance CSV uploaded successfully",
      batchId: importBatchId,
      status: "draft",
      data: buildAttendanceStateFromDbRows(sheetRows.rows),
    });
  } catch (error) {
    console.error("🔥 Attendance upload error:", error);
    console.error("🔥 Attendance upload stack:", error?.stack);

    return res.status(500).json({
      message: "Failed to upload attendance CSV",
      error: error?.message || "Unknown server error",
      stack: error?.stack || null,
    });
  }
});

router.get("/sheet", async (req, res) => {
  try {
    const { month, year, batchId, employeeCode, employeeName, employeeView } = req.query;

    let batchRes;

    if (batchId) {
      batchRes = await query(
        `SELECT * FROM attendance_import_batches WHERE id = $1`,
        [batchId]
      );
    } else {
      batchRes = await query(
        `SELECT * FROM attendance_import_batches
         WHERE month_int = $1 AND year_int = $2
         ORDER BY created_at DESC
         LIMIT 1`,
        [month, year]
      );
    }

    if (!batchRes.rows.length) {
      return res.status(404).json({ message: "Attendance batch not found" });
    }

    const batch = batchRes.rows[0];

    if (String(employeeView) === "true" && !batch.visible_to_employees) {
      return res.status(403).json({
        message: "Attendance sheet is not approved yet",
      });
    }

    const params = [batch.id];
    let whereExtra = "";

    if (employeeCode) {
      params.push(employeeCode);
      whereExtra += ` AND employee_code = $${params.length}`;
    } else if (employeeName) {
      params.push(employeeName);
      whereExtra += ` AND employee_name = $${params.length}`;
    }

    const recordsRes = await query(
      `SELECT * FROM attendance_records
       WHERE import_batch_id = $1 ${whereExtra}
       ORDER BY employee_name ASC, work_date ASC`,
      params
    );

    return res.status(200).json({
      batch,
      data: buildAttendanceStateFromDbRows(recordsRes.rows),
    });
  } catch (error) {
    console.error("🔥 Get attendance sheet error:", error);
    console.error("🔥 Get attendance sheet stack:", error?.stack);

    return res.status(500).json({
      message: "Failed to load attendance sheet",
      error: error?.message || "Unknown server error",
      stack: error?.stack || null,
    });
  }
});

router.post("/row/:rowId/override", async (req, res) => {
  try {
    const { rowId } = req.params;
    const { overrideType, overrideNote, username } = req.body;

    const allowed = [
      "present",
      "takleef",
      "annual_leave",
      "sick_leave",
      "permission",
      "absent",
      "weekend",
    ];

    if (!allowed.includes(overrideType)) {
      return res.status(400).json({ message: "Invalid override type" });
    }

    const rowRes = await query(
      `SELECT ar.*, ab.status
       FROM attendance_records ar
       JOIN attendance_import_batches ab ON ab.id = ar.import_batch_id
       WHERE ar.id = $1`,
      [rowId]
    );

    if (!rowRes.rows.length) {
      return res.status(404).json({ message: "Attendance row not found" });
    }

    if (rowRes.rows[0].status === "approved") {
      return res.status(400).json({
        message: "Approved attendance sheet cannot be edited",
      });
    }

    await query(
      `UPDATE attendance_records
       SET override_type = $1,
           override_note = $2,
           updated_by = $3,
           updated_at = NOW()
       WHERE id = $4`,
      [overrideType, overrideNote || null, username || "system", rowId]
    );

    return res.status(200).json({
      message: "Attendance row updated successfully",
    });
  } catch (error) {
    console.error("🔥 Update attendance row error:", error);
    console.error("🔥 Update attendance row stack:", error?.stack);

    return res.status(500).json({
      message: "Failed to update attendance row",
      error: error?.message || "Unknown server error",
      stack: error?.stack || null,
    });
  }
});

router.post("/approve/:batchId", async (req, res) => {
  try {
    const { batchId } = req.params;
    const { username } = req.body;

    const batchRes = await query(
      `SELECT * FROM attendance_import_batches WHERE id = $1`,
      [batchId]
    );

    if (!batchRes.rows.length) {
      return res.status(404).json({ message: "Attendance batch not found" });
    }

    await query(
      `UPDATE attendance_import_batches
       SET status = 'approved',
           visible_to_employees = true,
           approved_by = $1,
           approved_at = NOW()
       WHERE id = $2`,
      [username || "HR Manager", batchId]
    );

    return res.status(200).json({
      message: "Attendance sheet approved successfully",
    });
  } catch (error) {
    console.error("🔥 Approve attendance batch error:", error);
    console.error("🔥 Approve attendance batch stack:", error?.stack);

    return res.status(500).json({
      message: "Failed to approve attendance batch",
      error: error?.message || "Unknown server error",
      stack: error?.stack || null,
    });
  }
});

export default router;
