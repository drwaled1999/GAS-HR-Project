import express from "express";
import multer from "multer";
import { parse } from "csv-parse/sync";
import { query } from "../data/index.js";
import { requireAuth } from "../middleware_auth.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(requireAuth);

function normalizeRole(value) {
  return String(value || "").trim().toLowerCase();
}

function getCurrentRole(user) {
  return normalizeRole(user?.roleName || user?.role || user?.roleCode);
}

function canManageAttendance(user) {
  const role = getCurrentRole(user);
  return [
    "system owner",
    "owner",
    "system_owner",
    "hr manager",
    "hr_manager",
    "hr admin",
    "hr_admin",
    "hr",
    "cm",
    "project manager",
    "project_manager",
  ].includes(role);
}

function canApproveAttendance(user) {
  const role = getCurrentRole(user);
  return [
    "system owner",
    "owner",
    "system_owner",
    "hr manager",
    "hr_manager",
    "hr",
  ].includes(role);
}

function parseHours(value) {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    value === "-" ||
    value === "0" ||
    value === "0:00" ||
    value === "0:00:00"
  ) {
    return 0;
  }

  const raw = String(value).trim();

  if (/^\d+(\.\d+)?$/.test(raw)) {
    return Math.round(Number(raw) * 100) / 100;
  }

  const parts = raw.split(":").map(Number);
  if (parts.length < 2 || Number.isNaN(parts[0])) return 0;

  const h = parts[0] || 0;
  const m = parts[1] || 0;
  const s = parts[2] || 0;

  return Math.round((h + m / 60 + s / 3600) * 100) / 100;
}

function getWorkHours(row) {
  return parseHours(
    row["Total Work Hours"] ||
      row["Total work hours"] ||
      row["Total_Work_Hours"] ||
      row["TotalWorkHours"] ||
      row["Regular hours"] ||
      row["Regular Hours"] ||
      0
  );
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

function normalizeEmployeeKey(row) {
  const code = String(row.employee_code || "").trim();
  const name = String(row.employee_name || "").trim();
  return `${code}__${name}`;
}

function getDefaultPresentHours() {
  return 8;
}

function mapOverrideToCell(type, row) {
  switch (type) {
    case "present": {
      const effectiveHours =
        Number(row.regular_hours) > 0
          ? Number(row.regular_hours)
          : getDefaultPresentHours();

      return {
        value: String(Math.round(effectiveHours)),
        type: "hours",
      };
    }

    case "takleef":
      return { value: "TK", type: "takleef" };

    case "annual_leave":
      return { value: "AL", type: "leave" };

    case "sick_leave":
      return { value: "SL", type: "sick" };

    case "emergency_leave":
      return { value: "EL", type: "leave" };

    case "permission":
      return { value: "PM", type: "permission" };

    case "absent":
      return { value: "A", type: "absent" };

    case "weekend":
      return { value: "OFF", type: "weekend" };
    case "holiday":
      return { value: "HOL", type: "holiday" };

    default:
      return null;
  }
}

function classifyLeaveValue(leaveValue) {
  const value = String(leaveValue || "").trim().toLowerCase();

  if (!value || value === "-" || value === "--") return null;
  if (value.includes("sick")) return { value: "SL", type: "sick", bucket: "sick" };
  if (value.includes("emergency")) return { value: "EL", type: "leave", bucket: "emergency" };
  if (value.includes("annual")) return { value: "AL", type: "leave", bucket: "annual" };
  if (value.includes("permission")) return { value: "PM", type: "permission", bucket: "permission" };
  if (value.includes("takleef") || value.includes("task")) {
    return { value: "TK", type: "takleef", bucket: "takleef" };
  }

  return { value: "AL", type: "leave", bucket: "annual" };
}

function choosePreferredRow(existing, incoming) {
  if (!existing) return incoming;
  if (!incoming) return existing;

  const existingUpdated = existing.updated_at
    ? new Date(existing.updated_at).getTime()
    : 0;

  const incomingUpdated = incoming.updated_at
    ? new Date(incoming.updated_at).getTime()
    : 0;

  if (incomingUpdated > existingUpdated) return incoming;
  if (existingUpdated > incomingUpdated) return existing;

  const existingId = String(existing.id || "");
  const incomingId = String(incoming.id || "");

  if (incomingId > existingId) return incoming;
  return existing;
}

function buildAttendanceStateFromDbRows(records) {
  if (!records || !records.length) {
    return { days: [], rows: [], monthTitle: "Projects Attendance" };
  }

  const employeesMap = {};
  const datesMap = {};
  const dedupedMap = new Map();

  records.forEach((row) => {
    const name = String(row.employee_name || "").trim();
    const userId = String(row.employee_code || "").trim();
    const dateObj = normalizeDate(row.work_date);

    if (!name || !dateObj) return;

    const dateKey = toLocalDateKey(dateObj);
    datesMap[dateKey] = dateObj;

    const employeeKey = `${userId}__${name}`;
    const uniqueKey = `${employeeKey}__${dateKey}`;

    const existing = dedupedMap.get(uniqueKey);
    dedupedMap.set(uniqueKey, choosePreferredRow(existing, row));
  });

  const cleanRecords = Array.from(dedupedMap.values());

  cleanRecords.forEach((row) => {
    const name = String(row.employee_name || "").trim();
    const userId = String(row.employee_code || "").trim();
    const dateObj = normalizeDate(row.work_date);

    if (!name || !dateObj) return;

    const dateKey = toLocalDateKey(dateObj);
    const employeeKey = normalizeEmployeeKey(row);

    if (!employeesMap[employeeKey]) {
      employeesMap[employeeKey] = {
        name,
        userId,
        nationality: row.employee_nationality || "",
        project: row.project_name || row.batch_project_name || "-",
        package: row.package_name || "-",
        byDay: {},
        totalHours: 0,
        absentCount: 0,
        singlePunchCount: 0,
        annualLeaveCount: 0,
        sickLeaveCount: 0,
        emergencyLeaveCount: 0,
        permissionCount: 0,
        takleefCount: 0,
      };
    }

    let cell = null;

    if (row.override_type) {
      cell = mapOverrideToCell(row.override_type, row) || {
        value: "",
        type: "normal",
      };

      if (row.override_type === "absent") employeesMap[employeeKey].absentCount += 1;
      if (row.override_type === "annual_leave") employeesMap[employeeKey].annualLeaveCount += 1;
      if (row.override_type === "sick_leave") employeesMap[employeeKey].sickLeaveCount += 1;
      if (row.override_type === "emergency_leave") employeesMap[employeeKey].emergencyLeaveCount += 1;
      if (row.override_type === "permission") employeesMap[employeeKey].permissionCount += 1;
      if (row.override_type === "takleef") employeesMap[employeeKey].takleefCount += 1;

      if (row.override_type === "present") {
        const effectiveHours =
          Number(row.regular_hours) > 0
            ? Number(row.regular_hours)
            : getDefaultPresentHours();

        employeesMap[employeeKey].totalHours += Math.round(effectiveHours);
      }
    } else {
      const exception = String(row.exception_text || "").trim();
      const leave = String(row.leave_text || "").trim();
      const totalHours = Number(row.regular_hours || 0);
      const inTime = String(row.check_in || "").trim();
      const outTime = String(row.check_out || "").trim();

      cell = { value: "", type: "normal" };

      const leaveInfo = classifyLeaveValue(leave);

      if (leaveInfo) {
        cell = { value: leaveInfo.value, type: leaveInfo.type };

        if (leaveInfo.bucket === "annual") employeesMap[employeeKey].annualLeaveCount += 1;
        if (leaveInfo.bucket === "sick") employeesMap[employeeKey].sickLeaveCount += 1;
        if (leaveInfo.bucket === "emergency") employeesMap[employeeKey].emergencyLeaveCount += 1;
        if (leaveInfo.bucket === "permission") employeesMap[employeeKey].permissionCount += 1;
        if (leaveInfo.bucket === "takleef") employeesMap[employeeKey].takleefCount += 1;
      } else if (/absence/i.test(exception)) {
        cell = { value: "A", type: "absent" };
        employeesMap[employeeKey].absentCount += 1;
      } else if (
        /missing punch/i.test(exception) ||
        (inTime && inTime !== "-" && (!outTime || outTime === "-")) ||
        (outTime && outTime !== "-" && (!inTime || inTime === "-"))
      ) {
        cell = { value: "SP", type: "single" };
        employeesMap[employeeKey].singlePunchCount += 1;
      } else if (totalHours > 0) {
        const roundedHours = Math.round(totalHours);
        cell = { value: String(roundedHours), type: "hours" };
        employeesMap[employeeKey].totalHours += roundedHours;
      }
    }

    employeesMap[employeeKey].byDay[dateKey] = {
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
    let absentCount = emp.absentCount;

    const cells = days.map((day) => {
      const existing = emp.byDay[day.key];
      if (existing) return existing;

      if (day.weekend) {
        return {
          value: "OFF",
          type: "weekend",
          rowId: null,
          overrideType: "",
          overrideNote: "",
        };
      }

      absentCount += 1;

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
      absentCount,
      totalHours: emp.totalHours,
    };
  });

  const firstDay = days[0]?.key ? normalizeDate(days[0].key) : null;
  const monthTitle = firstDay
    ? `${firstDay.toLocaleString("en-US", { month: "long" })} Projects Attendance`
    : "Projects Attendance";

  return { days, rows, monthTitle };
}

async function getBatchByMonthYear(month, year, batchId = null, options = {}) {
  const employeeView = Boolean(options.employeeView);
  const projectKey = String(options.projectKey || "").trim();

  if (batchId) {
    const batchRes = await query(
      `SELECT * FROM project_attendance_batches WHERE id = $1 LIMIT 1`,
      [batchId]
    );
    return batchRes.rows[0] || null;
  }

  if (!month || !year || !projectKey) return null;

  const monthInt = Number(month);
  const yearInt = Number(year);

  if (employeeView) {
    const batchRes = await query(
      `
      SELECT ab.*
      FROM project_attendance_batches ab
      WHERE ab.month_int = $1
        AND ab.year_int = $2
        AND ab.project_key = $3
        AND ab.status = 'approved'
        AND ab.visible_to_employees = true
      ORDER BY
        ab.approved_at DESC NULLS LAST,
        ab.created_at DESC
      LIMIT 1
      `,
      [monthInt, yearInt, projectKey]
    );

    return batchRes.rows[0] || null;
  }

  const batchRes = await query(
    `
    SELECT ab.*
    FROM project_attendance_batches ab
    WHERE ab.month_int = $1
      AND ab.year_int = $2
      AND ab.project_key = $3
    ORDER BY
      CASE WHEN ab.status = 'approved' THEN 0 ELSE 1 END,
      ab.approved_at DESC NULLS LAST,
      ab.created_at DESC
    LIMIT 1
    `,
    [monthInt, yearInt, projectKey]
  );

  return batchRes.rows[0] || null;
}

async function getBatchRows(batchId, extraWhere = "", params = []) {
  const baseParams = [batchId];
  const mergedParams = [...baseParams];

  let dynamicExtra = extraWhere;
  const offset = mergedParams.length;

  params.forEach((value, index) => {
    mergedParams.push(value);
    dynamicExtra = dynamicExtra.replace(
      new RegExp(`\\$${index + 2}`, "g"),
      `$${offset + index + 1}`
    );
  });

  const result = await query(
    `
    SELECT
      ar.*,
      emp.nationality AS employee_nationality,
      emp.project_name,
      emp.package_name,
      ab.project_name AS batch_project_name
    FROM project_attendance_records ar
    JOIN project_attendance_batches ab
      ON ab.id = ar.import_batch_id
    LEFT JOIN employees emp
      ON emp.gas_id = ar.employee_code
      OR emp.full_name = ar.employee_name
    WHERE ar.import_batch_id = $1
      ${dynamicExtra}
    ORDER BY ar.employee_name ASC, ar.work_date ASC, ar.updated_at ASC NULLS LAST, ar.id ASC
    `,
    mergedParams
  );

  return result.rows;
}

function mapStatusToOverride(status) {
  const value = String(status || "").trim().toLowerCase();

  if (!value) return null;
  if (value === "present") return "present";
  if (value === "annual leave") return "annual_leave";
  if (value === "sick leave") return "sick_leave";
  if (value === "emergency leave") return "emergency_leave";
  if (value === "permission") return "permission";
  if (value === "absent") return "absent";
  if (value === "takleef") return "takleef";
  if (value === "holiday") return "holiday";
  if (value === "weekend" || value === "off") return "weekend";

  return null;
}

function buildIssuesFromState(state) {
  const rows = [];
  const summary = {
    absent: 0,
    singlePunch: 0,
    missingRecord: 0,
    lowHours: 0,
    modifiedRecord: 0,
  };

  const safeDays = Array.isArray(state?.days) ? state.days : [];
  const safeRows = Array.isArray(state?.rows) ? state.rows : [];

  safeRows.forEach((employee) => {
    const minHours = getDefaultPresentHours();

    safeDays.forEach((day, index) => {
      const cell = employee?.cells?.[index];
      if (!cell || cell.type === "weekend") return;

      let issueType = null;
      let hours = 0;
      const rawValue = String(cell.value ?? "").trim();

      if (cell.rowId === null && rawValue === "A") {
        issueType = "Missing Record";
        summary.missingRecord += 1;
      } else if (cell.type === "single" || rawValue === "SP") {
        issueType = "Single Punch";
        summary.singlePunch += 1;
      } else if (cell.type === "absent" && rawValue === "A") {
        issueType = "Absent";
        summary.absent += 1;
      } else if (cell.overrideType) {
        issueType = "Modified Record";
        summary.modifiedRecord += 1;
        hours = !Number.isNaN(Number(rawValue)) ? Number(rawValue) : 0;
      } else if (
        !Number.isNaN(Number(rawValue)) &&
        Number(rawValue) > 0 &&
        Number(rawValue) < minHours
      ) {
        issueType = "Low Hours";
        summary.lowHours += 1;
        hours = Number(rawValue || 0);
      }

      if (!issueType) return;

      rows.push({
        employeeCode: employee.userId || "",
        employeeName: employee.name || "",
        gasId: employee.userId || "-",
        name: employee.name || "-",
        project: employee.project || "-",
        package: employee.package || "-",
        date: day.key,
        status: rawValue || "-",
        hours,
        source: cell.rowId ? "device" : "system",
        issueType,
        note: cell.overrideNote || "",
        rowId: cell.rowId || null,
      });
    });
  });

  return { rows, summary };
}

router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!canManageAttendance(req.user)) {
      return res.status(403).json({
        message: "You do not have permission to upload project attendance",
      });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const {
      month,
      year,
      username,
      projectKey,
      projectName,
    } = req.body;

    if (!month || !year || !projectKey) {
      return res.status(400).json({
        message: "Month, year, and projectKey are required",
      });
    }

    const monthInt = Number(month);
    const yearInt = Number(year);
    const cleanProjectKey = String(projectKey).trim();
    const cleanProjectName = String(projectName || projectKey).trim();

    const records = parse(req.file.buffer.toString("utf-8"), {
      columns: true,
      skip_empty_lines: true,
      bom: true,
    });

    if (!records.length) {
      return res.status(400).json({ message: "CSV file is empty" });
    }

    const existingBatchRes = await query(
      `
      SELECT *
      FROM project_attendance_batches
      WHERE month_int = $1
        AND year_int = $2
        AND project_key = $3
      ORDER BY
        CASE WHEN status = 'approved' THEN 0 ELSE 1 END,
        approved_at DESC NULLS LAST,
        created_at DESC
      LIMIT 1
      `,
      [monthInt, yearInt, cleanProjectKey]
    );

    let importBatchId = "";
    let batchStatus = "draft";

    if (existingBatchRes.rows.length) {
      const existingBatch = existingBatchRes.rows[0];

      importBatchId = existingBatch.id;
      batchStatus = existingBatch.status || "draft";

      if (batchStatus === "approved") {
        return res.status(400).json({
          message: "Approved project attendance sheet cannot be uploaded again. Reopen it first.",
        });
      }

      await query(
        `
        UPDATE project_attendance_batches
        SET file_name = $1,
            project_name = $2
        WHERE id = $3
        `,
        [req.file.originalname, cleanProjectName, importBatchId]
      );
    } else {
      const batchRes = await query(
        `
        INSERT INTO project_attendance_batches
          (file_name, month_int, year_int, status, visible_to_employees, project_key, project_name)
        VALUES ($1, $2, $3, 'draft', false, $4, $5)
        RETURNING id
        `,
        [
          req.file.originalname,
          monthInt,
          yearInt,
          cleanProjectKey,
          cleanProjectName,
        ]
      );

      importBatchId = batchRes.rows[0].id;
      batchStatus = "draft";
    }

    const actorName = username || req.user?.name || req.user?.username || "system";

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
      const totalHours = getWorkHours(record);
      const exceptionText = String(record["Exception"] || "").trim() || null;
      const leaveText = String(record["Leave"] || "").trim() || null;

      const existingRowRes = await query(
        `
        SELECT id
        FROM project_attendance_records
        WHERE import_batch_id = $1
          AND work_date = $2
          AND employee_name = $3
          AND COALESCE(employee_code, '') = COALESCE($4, '')
        LIMIT 1
        `,
        [importBatchId, workDate, employeeName, employeeCode || ""]
      );

      if (existingRowRes.rows.length) {
        await query(
          `
          UPDATE project_attendance_records
          SET
            check_in = $1,
            check_out = $2,
            regular_hours = $3,
            exception_text = $4,
            leave_text = $5,
            updated_by = $6,
            updated_at = NOW()
          WHERE id = $7
          `,
          [
            checkIn,
            checkOut,
            totalHours,
            exceptionText,
            leaveText,
            actorName,
            existingRowRes.rows[0].id,
          ]
        );
      } else {
        await query(
          `
          INSERT INTO project_attendance_records
          (
            import_batch_id,
            employee_code,
            employee_name,
            work_date,
            check_in,
            check_out,
            regular_hours,
            exception_text,
            leave_text,
            updated_by,
            updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
          `,
          [
            importBatchId,
            employeeCode,
            employeeName,
            workDate,
            checkIn,
            checkOut,
            totalHours,
            exceptionText,
            leaveText,
            actorName,
          ]
        );
      }
    }

    const dbRows = await getBatchRows(importBatchId);
    const data = buildAttendanceStateFromDbRows(dbRows);

    return res.status(200).json({
      message: "Project attendance CSV uploaded and merged successfully",
      batchId: importBatchId,
      status: batchStatus,
      data,
    });
  } catch (error) {
    console.error("🔥 Project attendance upload error:", error);
    console.error("🔥 Project attendance upload stack:", error?.stack);

    return res.status(500).json({
      message: "Failed to upload project attendance CSV",
      error: error?.message || "Unknown server error",
      stack: error?.stack || null,
    });
  }
});

router.get("/sheet", async (req, res) => {
  try {
    if (!canManageAttendance(req.user) && String(req.query.employeeView) !== "true") {
      return res.status(403).json({
        message: "You do not have permission to view this project attendance sheet",
      });
    }

    const {
      month,
      year,
      batchId,
      employeeCode,
      employeeName,
      employeeView,
      projectKey,
    } = req.query;

    const batch = await getBatchByMonthYear(month, year, batchId, {
      employeeView: String(employeeView) === "true",
      projectKey,
    });

    if (!batch) {
      return res.status(404).json({ message: "Project attendance batch not found" });
    }

    if (String(employeeView) === "true" && !batch.visible_to_employees) {
      return res.status(403).json({
        message: "Project attendance sheet is not approved yet",
      });
    }

    const params = [];
    let whereExtra = "";

    if (employeeCode) {
      params.push(employeeCode);
      whereExtra += ` AND ar.employee_code = $2`;
    } else if (employeeName) {
      params.push(employeeName);
      whereExtra += ` AND ar.employee_name = $2`;
    }

    const recordsRes = await getBatchRows(batch.id, whereExtra, params);
    const data = buildAttendanceStateFromDbRows(recordsRes);

    return res.status(200).json({
      batch,
      data,
    });
  } catch (error) {
    console.error("🔥 Get project attendance sheet error:", error);
    console.error("🔥 Get project attendance sheet stack:", error?.stack);

    return res.status(500).json({
      message: "Failed to load project attendance sheet",
      error: error?.message || "Unknown server error",
      stack: error?.stack || null,
    });
  }
});

router.get("/issues", async (req, res) => {
  try {
    if (!canManageAttendance(req.user)) {
      return res.status(403).json({
        message: "You do not have permission to view project attendance issues",
      });
    }

    const { month, year, batchId, projectKey } = req.query;

    const batch = await getBatchByMonthYear(month, year, batchId, {
      projectKey,
    });

    if (!batch) {
      return res.status(404).json({ message: "Project attendance batch not found" });
    }

    const records = await getBatchRows(batch.id);
    const state = buildAttendanceStateFromDbRows(records);
    const result = buildIssuesFromState(state);

    return res.json({
      batch,
      rows: result.rows,
      summary: result.summary,
    });
  } catch (error) {
    console.error("🔥 Get project attendance issues error:", error);
    return res.status(500).json({
      message: "Failed to load project attendance issues",
      error: error?.message || "Unknown server error",
    });
  }
});

router.post("/direct-update", async (req, res) => {
  try {
    if (!canManageAttendance(req.user)) {
      return res.status(403).json({
        message: "You do not have permission to update project attendance directly",
      });
    }

    const {
      batchId,
      month,
      year,
      projectKey,
      employeeCode,
      employeeName,
      date,
      newStatus,
      hours,
      actorName,
      note,
    } = req.body || {};

    if (!date || !employeeName) {
      return res.status(400).json({
        message: "employeeName and date are required",
      });
    }

    const batch = await getBatchByMonthYear(month, year, batchId, {
      projectKey,
    });

    if (!batch) {
      return res.status(404).json({ message: "Project attendance batch not found" });
    }

    if (batch.status === "approved") {
      return res.status(400).json({
        message: "Approved project attendance sheet cannot be edited",
      });
    }

    const overrideType = mapStatusToOverride(newStatus);
    const numericHours = Number(hours || 0);

    if (newStatus && !overrideType && String(newStatus).trim() !== "") {
      return res.status(400).json({
        message: "Invalid status value",
      });
    }

    const existingRes = await query(
      `SELECT *
       FROM project_attendance_records
       WHERE import_batch_id = $1
         AND employee_name = $2
         AND work_date = $3
         AND (
           COALESCE(employee_code, '') = COALESCE($4, '')
           OR $4 IS NULL
           OR $4 = ''
         )
       ORDER BY updated_at DESC NULLS LAST, id DESC
       LIMIT 1`,
      [batch.id, employeeName, date, employeeCode || ""]
    );

    if (existingRes.rows.length) {
      const existing = existingRes.rows[0];

      await query(
        `UPDATE project_attendance_records
         SET
           override_type = $1,
           override_note = $2,
           regular_hours = $3,
           updated_by = $4,
           updated_at = NOW()
         WHERE id = $5`,
        [
          overrideType,
          note || `Direct update → ${newStatus || "Auto"}`,
          overrideType === "present"
            ? (Number.isFinite(numericHours) && numericHours >= 0
                ? numericHours
                : getDefaultPresentHours())
            : 0,
          actorName || req.user?.name || req.user?.username || "HR Manager",
          existing.id,
        ]
      );
    } else {
      await query(
        `INSERT INTO project_attendance_records
         (
           import_batch_id,
           employee_code,
           employee_name,
           work_date,
           check_in,
           check_out,
           regular_hours,
           exception_text,
           leave_text,
           override_type,
           override_note,
           updated_by,
           updated_at
         )
         VALUES ($1,$2,$3,$4,NULL,NULL,$5,NULL,NULL,$6,$7,$8,NOW())`,
        [
          batch.id,
          employeeCode || "",
          employeeName,
          date,
          overrideType === "present"
            ? (Number.isFinite(numericHours) && numericHours >= 0
                ? numericHours
                : getDefaultPresentHours())
            : 0,
          overrideType,
          note || `Direct update → ${newStatus || "Auto"}`,
          actorName || req.user?.name || req.user?.username || "HR Manager",
        ]
      );
    }

    return res.json({
      message: "Project attendance record updated successfully",
    });
  } catch (error) {
    console.error("🔥 Project direct update error:", error);
    return res.status(500).json({
      message: "Failed to update project attendance record",
      error: error?.message || "Unknown server error",
    });
  }
});

router.post("/row/:rowId/override", async (req, res) => {
  try {
    if (!canManageAttendance(req.user)) {
      return res.status(403).json({
        message: "You do not have permission to override project attendance rows",
      });
    }

    const { rowId } = req.params;
    const { overrideType, overrideNote, username, manualHours } = req.body;

    const allowed = [
      "",
      "present",
      "takleef",
      "annual_leave",
      "sick_leave",
      "emergency_leave",
      "permission",
      "absent",
      "weekend",
    ];

    if (!allowed.includes(String(overrideType ?? ""))) {
      return res.status(400).json({ message: "Invalid override type" });
    }

    const rowRes = await query(
      `SELECT ar.*, ab.status, emp.nationality AS employee_nationality
       FROM project_attendance_records ar
       JOIN project_attendance_batches ab ON ab.id = ar.import_batch_id
       LEFT JOIN employees emp
         ON emp.gas_id = ar.employee_code
         OR emp.full_name = ar.employee_name
       WHERE ar.id = $1`,
      [rowId]
    );

    if (!rowRes.rows.length) {
      return res.status(404).json({ message: "Project attendance row not found" });
    }

    if (rowRes.rows[0].status === "approved") {
      return res.status(400).json({
        message: "Approved project attendance sheet cannot be edited",
      });
    }

    const currentRow = rowRes.rows[0];
    const actorName = username || req.user?.name || req.user?.username || "system";

    if (String(overrideType ?? "") === "") {
      await query(
        `UPDATE project_attendance_records
         SET override_type = NULL,
             override_note = NULL,
             updated_by = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [actorName, rowId]
      );
    } else {
      let nextRegularHours = currentRow.regular_hours;

      if (overrideType === "present") {
        const parsedManualHours = Number(manualHours);
        nextRegularHours =
          Number.isFinite(parsedManualHours) && parsedManualHours >= 0
            ? parsedManualHours
            : getDefaultPresentHours();
      } else if (
        [
          "absent",
          "weekend",
          "annual_leave",
          "sick_leave",
          "emergency_leave",
          "permission",
        ].includes(overrideType)
      ) {
        nextRegularHours = 0;
      }

      await query(
        `UPDATE project_attendance_records
         SET override_type = $1,
             override_note = $2,
             regular_hours = $3,
             updated_by = $4,
             updated_at = NOW()
         WHERE id = $5`,
        [
          overrideType,
          overrideNote || null,
          nextRegularHours,
          actorName,
          rowId,
        ]
      );
    }

    return res.status(200).json({
      message: "Project attendance row updated successfully",
    });
  } catch (error) {
    console.error("🔥 Update project attendance row error:", error);
    console.error("🔥 Update project attendance row stack:", error?.stack);

    return res.status(500).json({
      message: "Failed to update project attendance row",
      error: error?.message || "Unknown server error",
      stack: error?.stack || null,
    });
  }
});

router.post("/approve/:batchId", async (req, res) => {
  try {
    if (!canApproveAttendance(req.user)) {
      return res.status(403).json({
        message: "You do not have permission to approve project attendance",
      });
    }

    const { batchId } = req.params;
    const { username } = req.body;

    const batchRes = await query(
      `SELECT * FROM project_attendance_batches WHERE id = $1`,
      [batchId]
    );

    if (!batchRes.rows.length) {
      return res.status(404).json({ message: "Project attendance batch not found" });
    }

    const currentBatch = batchRes.rows[0];

    await query(
      `UPDATE project_attendance_batches
       SET status = 'draft',
           visible_to_employees = false
       WHERE month_int = $1
         AND year_int = $2
         AND project_key = $3
         AND id <> $4
         AND status = 'approved'`,
      [
        currentBatch.month_int,
        currentBatch.year_int,
        currentBatch.project_key,
        batchId,
      ]
    );

    await query(
      `UPDATE project_attendance_batches
       SET status = 'approved',
           visible_to_employees = true,
           approved_by = $1,
           approved_at = NOW()
       WHERE id = $2`,
      [username || req.user?.name || req.user?.username || "HR Manager", batchId]
    );

    return res.status(200).json({
      message: "Project attendance sheet approved successfully",
    });
  } catch (error) {
    console.error("🔥 Approve project attendance batch error:", error);
    console.error("🔥 Approve project attendance batch stack:", error?.stack);

    return res.status(500).json({
      message: "Failed to approve project attendance sheet",
      error: error?.message || "Unknown server error",
      stack: error?.stack || null,
    });
  }
});

router.post("/reopen/:batchId", async (req, res) => {
  try {
    if (!canApproveAttendance(req.user)) {
      return res.status(403).json({
        message: "You do not have permission to reopen project attendance",
      });
    }

    const { batchId } = req.params;

    const batchRes = await query(
      `SELECT * FROM project_attendance_batches WHERE id = $1 LIMIT 1`,
      [batchId]
    );

    if (!batchRes.rows.length) {
      return res.status(404).json({
        message: "Project attendance batch not found",
      });
    }

    const batch = batchRes.rows[0];

    if (batch.status !== "approved") {
      return res.status(400).json({
        message: "Batch is already editable",
      });
    }

    await query(
      `
      UPDATE project_attendance_batches
      SET
        status = 'draft',
        visible_to_employees = false,
        approved_by = NULL,
        approved_at = NULL
      WHERE id = $1
      `,
      [batchId]
    );

    return res.json({
      message: "Project attendance reopened successfully",
    });
  } catch (error) {
    console.error("🔥 Reopen project attendance error:", error);

    return res.status(500).json({
      message: "Failed to reopen project attendance",
      error: error?.message || "Unknown server error",
    });
  }
});
router.get("/monthly", async (req, res) => {
  try {
    const month = Number(req.query.month);
    const year = Number(req.query.year);

    if (!month || !year) {
      return res.status(400).json({
        message: "Month and year are required",
      });
    }

    const possibleCodes = [req.user?.gasId, req.user?.gas_id]
      .map((item) => String(item || "").trim())
      .filter(Boolean);

    const possibleNames = [req.user?.name, req.user?.full_name, req.user?.username]
      .map((item) => String(item || "").trim())
      .filter(Boolean);

    const batchesRes = await query(
      `
      SELECT *
      FROM project_attendance_batches
      WHERE month_int = $1
        AND year_int = $2
        AND status = 'approved'
        AND visible_to_employees = true
      ORDER BY project_name ASC, approved_at DESC NULLS LAST, created_at DESC
      `,
      [month, year]
    );

    if (!batchesRes.rows.length) {
      return res.json({
        projects: [],
        message: "No approved project attendance found",
      });
    }

    const projects = [];

    for (const batch of batchesRes.rows) {
      let rows = [];

      if (possibleCodes.length) {
        const codeRes = await query(
          `
          SELECT
            ar.*,
            emp.nationality AS employee_nationality,
            emp.project_name,
            emp.package_name,
            ab.project_name AS batch_project_name,
            ab.project_key
          FROM project_attendance_records ar
          JOIN project_attendance_batches ab
            ON ab.id = ar.import_batch_id
          LEFT JOIN employees emp
            ON emp.gas_id = ar.employee_code
            OR emp.full_name = ar.employee_name
          WHERE ar.import_batch_id = $1
            AND TRIM(ar.employee_code) = ANY($2::text[])
          ORDER BY ar.employee_name ASC, ar.work_date ASC, ar.updated_at ASC NULLS LAST, ar.id ASC
          `,
          [batch.id, possibleCodes]
        );

        rows = codeRes.rows;
      }

      if (!rows.length && possibleNames.length) {
        const nameRes = await query(
          `
          SELECT
            ar.*,
            emp.nationality AS employee_nationality,
            emp.project_name,
            emp.package_name,
            ab.project_name AS batch_project_name,
            ab.project_key
          FROM project_attendance_records ar
          JOIN project_attendance_batches ab
            ON ab.id = ar.import_batch_id
          LEFT JOIN employees emp
            ON emp.gas_id = ar.employee_code
            OR emp.full_name = ar.employee_name
          WHERE ar.import_batch_id = $1
            AND ar.employee_name = ANY($2::text[])
          ORDER BY ar.employee_name ASC, ar.work_date ASC, ar.updated_at ASC NULLS LAST, ar.id ASC
          `,
          [batch.id, possibleNames]
        );

        rows = nameRes.rows;
      }

      if (!rows.length) continue;

      projects.push({
        batch,
        data: buildAttendanceStateFromDbRows(rows),
      });
    }

    return res.json({
      projects,
    });
  } catch (error) {
    console.error("🔥 Monthly project employee attendance error:", error);
    return res.status(500).json({
      message: "Failed to load project employee attendance",
      error: error?.message || "Unknown server error",
    });
  }
});

function normalizeText(value) {
  return String(value || "").trim();
}

function buildEmployeeUniqueKey(employeeCode, employeeName) {
  return `${normalizeText(employeeCode)}__${normalizeText(employeeName)}`;
}

router.get("/sheet/:batchId/available-users", async (req, res) => {
  try {
    if (!canManageAttendance(req.user)) {
      return res.status(403).json({
        message: "You do not have permission to browse users for project attendance",
      });
    }

    const { batchId } = req.params;
    const search = normalizeText(req.query.search).toLowerCase();

    const batchRes = await query(
      `SELECT * FROM project_attendance_batches WHERE id = $1 LIMIT 1`,
      [batchId]
    );

    if (!batchRes.rows.length) {
      return res.status(404).json({ message: "Project attendance batch not found" });
    }

    const usersRes = await query(
      `
      SELECT
        u.id AS user_id,
        u.employee_id,
        COALESCE(u.full_name, u.name) AS name,
        u.gas_id AS gas_id,
        u.job_title,
        u.status,
        u.nationality_type AS nationality,
        e.project_name,
        e.package_name
      FROM users u
      LEFT JOIN employees e ON e.id = u.employee_id
      WHERE COALESCE(u.status, 'active') = 'active'
      ORDER BY COALESCE(u.full_name, u.name) ASC
      `
    );

    const existingRows = await getBatchRows(batchId);

    const existingSet = new Set(
      existingRows.map((row) =>
        buildEmployeeUniqueKey(row.employee_code, row.employee_name)
      )
    );

    const rows = usersRes.rows.filter((row) => {
      const uniqueKey = buildEmployeeUniqueKey(row.gas_id, row.name);

      if (!row.name) return false;
      if (existingSet.has(uniqueKey)) return false;

      if (!search) return true;

      return [
        row.name,
        row.gas_id,
        row.job_title,
        row.project_name,
        row.package_name,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search));
    });

    return res.json({ users: rows });
  } catch (error) {
    console.error("🔥 Available project attendance users error:", error);
    return res.status(500).json({
      message: "Failed to load available project attendance users",
      error: error?.message || "Unknown server error",
    });
  }
});

router.post("/sheet/:batchId/add-user", async (req, res) => {
  try {
    if (!canManageAttendance(req.user)) {
      return res.status(403).json({
        message: "You do not have permission to add employees to project attendance sheet",
      });
    }

    const { batchId } = req.params;
    const actorName = req.user?.name || req.user?.username || "HR Manager";
    const userId = req.body?.userId || null;

    const batchRes = await query(
      `SELECT * FROM project_attendance_batches WHERE id = $1 LIMIT 1`,
      [batchId]
    );

    if (!batchRes.rows.length) {
      return res.status(404).json({ message: "Project attendance batch not found" });
    }

    const batch = batchRes.rows[0];

    if (batch.status === "approved") {
      return res.status(400).json({
        message: "Approved project attendance sheet cannot be edited",
      });
    }

    let employeeRow = null;

    if (userId) {
      const userRes = await query(
        `
        SELECT
          u.id AS user_id,
          u.employee_id,
          COALESCE(u.full_name, u.name) AS name,
          u.gas_id AS gas_id,
          u.job_title,
          u.nationality_type AS nationality,
          e.project_name,
          e.package_name
        FROM users u
        LEFT JOIN employees e ON e.id = u.employee_id
        WHERE u.id = $1
        LIMIT 1
        `,
        [userId]
      );

      employeeRow = userRes.rows[0] || null;
    } else {
      employeeRow = {
        user_id: null,
        employee_id: req.body?.employeeId || null,
        name: normalizeText(req.body?.employeeName),
        gas_id: normalizeText(req.body?.employeeCode),
        job_title: normalizeText(req.body?.jobTitle) || null,
        nationality: normalizeText(req.body?.nationality) || null,
        project_name: normalizeText(req.body?.projectName) || null,
        package_name: normalizeText(req.body?.packageName) || null,
      };
    }

    if (!employeeRow?.name) {
      return res.status(400).json({
        message: "Employee name is required",
      });
    }

    const existingRes = await query(
      `
      SELECT id
      FROM project_attendance_records
      WHERE import_batch_id = $1
        AND COALESCE(employee_code, '') = COALESCE($2, '')
        AND employee_name = $3
      LIMIT 1
      `,
      [batchId, employeeRow.gas_id || "", employeeRow.name]
    );

    if (existingRes.rows.length) {
      return res.status(400).json({
        message: "Employee already exists in this project attendance sheet",
      });
    }

    const firstDay = new Date(Number(batch.year_int), Number(batch.month_int) - 1, 1, 12, 0, 0);
    const lastDay = new Date(Number(batch.year_int), Number(batch.month_int), 0, 12, 0, 0);

    for (
      let d = new Date(firstDay);
      d <= lastDay;
      d.setDate(d.getDate() + 1)
    ) {
      const workDate = toLocalDateKey(d);
      const isWeekend = d.getDay() === 5 || d.getDay() === 6;

      await query(
        `
        INSERT INTO project_attendance_records
        (
          import_batch_id,
          employee_code,
          employee_name,
          work_date,
          check_in,
          check_out,
          regular_hours,
          exception_text,
          leave_text,
          override_type,
          override_note,
          updated_by,
          updated_at
        )
        VALUES ($1,$2,$3,$4,NULL,NULL,0,NULL,NULL,$5,$6,$7,NOW())
        `,
        [
          batchId,
          employeeRow.gas_id || "",
          employeeRow.name,
          workDate,
          isWeekend ? "weekend" : "absent",
          "Manual added employee",
          actorName,
        ]
      );
    }

    return res.json({
      message: "Employee added to project attendance sheet successfully",
    });
  } catch (error) {
    console.error("🔥 Add employee to project attendance sheet error:", error);
    return res.status(500).json({
      message: "Failed to add employee to project attendance sheet",
      error: error?.message || "Unknown server error",
    });
  }
});

router.post("/sheet/:batchId/exclude-user", async (req, res) => {
  try {
    if (!canManageAttendance(req.user)) {
      return res.status(403).json({
        message: "You do not have permission to exclude employees from project attendance sheet",
      });
    }

    const { batchId } = req.params;
    const employeeCode = normalizeText(req.body?.employeeCode);
    const employeeName = normalizeText(req.body?.employeeName);

    if (!employeeName) {
      return res.status(400).json({
        message: "Employee name is required",
      });
    }

    const batchRes = await query(
      `SELECT * FROM project_attendance_batches WHERE id = $1 LIMIT 1`,
      [batchId]
    );

    if (!batchRes.rows.length) {
      return res.status(404).json({ message: "Project attendance batch not found" });
    }

    if (batchRes.rows[0].status === "approved") {
      return res.status(400).json({
        message: "Approved project attendance sheet cannot be edited",
      });
    }

    await query(
      `
      DELETE FROM project_attendance_records
      WHERE import_batch_id = $1
        AND employee_name = $2
        AND (
          COALESCE(employee_code, '') = COALESCE($3, '')
          OR $3 = ''
        )
      `,
      [batchId, employeeName, employeeCode || ""]
    );

    return res.json({
      message: "Employee excluded from project attendance sheet successfully",
    });
  } catch (error) {
    console.error("🔥 Exclude employee from project attendance sheet error:", error);
    return res.status(500).json({
      message: "Failed to exclude employee from project attendance sheet",
      error: error?.message || "Unknown server error",
    });
  }
});

router.post("/sheet/mark-user-status", async (req, res) => {
  try {
    if (!canManageAttendance(req.user)) {
      return res.status(403).json({
        message: "You do not have permission to update employee status",
      });
    }

    const employeeCode = normalizeText(req.body?.employeeCode);
    const employeeName = normalizeText(req.body?.employeeName);
    const nextStatus = normalizeText(req.body?.status).toLowerCase();

    if (!employeeName && !employeeCode) {
      return res.status(400).json({
        message: "employeeCode or employeeName is required",
      });
    }

    if (!["inactive", "resigned"].includes(nextStatus)) {
      return res.status(400).json({
        message: "Status must be inactive or resigned",
      });
    }

    const usersRes = await query(
      `
      SELECT id
      FROM users
      WHERE ($1 <> '' AND COALESCE(gas_id, '') = $1)
         OR ($2 <> '' AND LOWER(COALESCE(full_name, name, '')) = LOWER($2))
      `,
      [employeeCode || "", employeeName || ""]
    );

    if (!usersRes.rows.length) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    await query(
      `
      UPDATE users
      SET
        status = $1,
        is_active = false,
        updated_at = NOW()
      WHERE id = ANY($2::uuid[])
      `,
      [nextStatus, usersRes.rows.map((row) => row.id)]
    );

    return res.json({
      message: `Employee status updated to ${nextStatus} successfully`,
    });
  } catch (error) {
    console.error("🔥 Mark project attendance employee status error:", error);
    return res.status(500).json({
      message: "Failed to update employee status",
      error: error?.message || "Unknown server error",
    });
  }
});

export default router;
