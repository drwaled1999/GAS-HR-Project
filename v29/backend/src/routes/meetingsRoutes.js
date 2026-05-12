import express from "express";
import { query } from "../data/index.js";
import { requireAuth } from "../middleware_auth.js";

const router = express.Router();

router.use(requireAuth);

let meetingsTablesPromise = null;

function normalizeRole(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "_");
}

function isAdminUser(user) {
  const role = normalizeRole(user?.roleName || user?.role || user?.roleCode);
  const roleId = String(user?.roleId || user?.role_id || "").trim();

  const adminRoles = [
    "owner",
    "system_owner",
    "hr_manager",
    "hr_admin",
    "hr",
    "admin",
    "admin_assistant",
    "site_admin",
    "project_manager",
    "cm",
  ];

  const adminRoleIds = [
    "53e49ba5-5386-4b1b-961e-bd1ec018eb30",
    "2e65abb1-6ecc-4283-abff-01f470543a08",
    "aae4ec90-0748-4a85-81a3-7ddead57a932",
    "03555f13-20d8-413b-8e8c-35a0c64b25b9",
    "afe04fc9-3b94-4ee6-a5a2-9eb86f483e71",
    "6c786092-4ba4-44f7-8cfc-7f2a3c902404",
    "068080fc-5ace-4985-ad89-9063a27905eb",
  ];

  return adminRoles.includes(role) || adminRoleIds.includes(roleId);
}

function requireAdmin(req, res, next) {
  if (!isAdminUser(req.user)) {
    return res.status(403).json({ message: "Admin access required" });
  }

  next();
}

async function ensureMeetingsTables() {
  if (!meetingsTablesPromise) {
    meetingsTablesPromise = createMeetingsTables().catch((error) => {
      meetingsTablesPromise = null;
      throw error;
    });
  }

  return meetingsTablesPromise;
}

async function createMeetingsTables() {
  await query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

  await query(`
    CREATE TABLE IF NOT EXISTS meeting_rooms (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL UNIQUE,
      location TEXT,
      capacity INTEGER,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS meetings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      agenda TEXT,
      meeting_date DATE NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT,
      location TEXT,
      meeting_link TEXT,
      priority TEXT NOT NULL DEFAULT 'normal',
      status TEXT NOT NULL DEFAULT 'scheduled',
      room_id UUID REFERENCES meeting_rooms(id) ON DELETE SET NULL,
      created_by UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS meeting_invites (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      response_status TEXT NOT NULL DEFAULT 'pending',
      response_note TEXT,
      responded_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(meeting_id, user_id)
    );
  `);

  await query(`
    INSERT INTO meeting_rooms (name, location, capacity)
    VALUES
      ('Meeting Room 1', 'HR Office', 10),
      ('Meeting Room 2', 'Admin Office', 8),
      ('Conference Room', 'Main Office', 20),
      ('Online Meeting', 'Microsoft Teams / Google Meet', 100)
    ON CONFLICT (name) DO NOTHING;
  `);
}

function mapInvite(row) {
  return {
    id: row.invite_id,
    employeeUserId: row.user_id,
    employeeName: row.employee_name,
    employeeEmail: row.employee_email,
    gasId: row.gas_id,
    responseStatus: row.response_status,
    responseNote: row.response_note,
    respondedAt: row.responded_at,
  };
}

function mapMeeting(row, invites = []) {
  return {
    id: row.id,
    title: row.title,
    agenda: row.agenda,
    meetingDate: row.meeting_date,
    startTime: row.start_time,
    endTime: row.end_time,
    location: row.location,
    meetingLink: row.meeting_link,
    priority: row.priority,
    status: row.status,
    roomId: row.room_id,
    roomName: row.room_name,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    invites,
  };
}

async function resolveSelectedEmployeeUserIds(employeeUserIds = []) {
  const ids = Array.isArray(employeeUserIds)
    ? employeeUserIds.map((id) => String(id || "").trim()).filter(Boolean)
    : [];

  if (!ids.length) return [];

  const result = await query(
    `
    SELECT DISTINCT u.id
    FROM users u
    WHERE u.id = ANY($1::uuid[])
       OR u.employee_id = ANY($1::uuid[])
    `,
    [ids]
  );

  return result.rows.map((row) => row.id);
}

router.get("/rooms", requireAdmin, async (_req, res) => {
  try {
    await ensureMeetingsTables();

    const result = await query(`
      SELECT id, name, location, capacity, is_active, created_at
      FROM meeting_rooms
      WHERE is_active = true
      ORDER BY name ASC
    `);

    return res.json({ rooms: result.rows });
  } catch (error) {
    console.error("GET /meetings/rooms error:", error);
    return res.status(500).json({
      message: error.message || "Failed to load rooms",
    });
  }
});

router.get("/employees", requireAdmin, async (_req, res) => {
  try {
    await ensureMeetingsTables();

    const result = await query(`
      SELECT
        u.id,
        COALESCE(u.full_name, u.name, u.username, e.full_name, 'Employee') AS name,
        u.username,
        COALESCE(u.email, e.email, '') AS email,
        COALESCE(u.gas_id, e.gas_id, '') AS gas_id,
        COALESCE(e.project_name, '') AS project_name,
        COALESCE(e.package_name, '') AS package_name
      FROM users u
      LEFT JOIN employees e
        ON e.id = u.employee_id
      WHERE COALESCE(u.is_active, true) = true
      ORDER BY COALESCE(u.full_name, u.name, u.username, e.full_name) ASC
    `);

    return res.json({
      employees: result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        username: row.username,
        email: row.email,
        gasId: row.gas_id,
        projectName: row.project_name,
        packageName: row.package_name,
        roleName: "Employee",
      })),
    });
  } catch (error) {
    console.error("GET /meetings/employees error:", error);
    return res.status(500).json({
      message: error.message || "Failed to load employees",
    });
  }
});

router.get("/admin", requireAdmin, async (_req, res) => {
  try {
    await ensureMeetingsTables();

    const meetingsResult = await query(`
      SELECT
        m.*,
        mr.name AS room_name,
        COALESCE(c.full_name, c.name, c.username) AS created_by_name
      FROM meetings m
      LEFT JOIN meeting_rooms mr ON mr.id = m.room_id
      LEFT JOIN users c ON c.id = m.created_by
      ORDER BY m.meeting_date DESC, m.start_time DESC, m.created_at DESC
    `);

    const invitesResult = await query(`
      SELECT
        mi.id AS invite_id,
        mi.meeting_id,
        mi.user_id,
        mi.response_status,
        mi.response_note,
        mi.responded_at,
        COALESCE(u.full_name, u.name, u.username, e.full_name) AS employee_name,
        COALESCE(u.email, e.email) AS employee_email,
        COALESCE(u.gas_id, e.gas_id) AS gas_id
      FROM meeting_invites mi
      LEFT JOIN users u ON u.id = mi.user_id
      LEFT JOIN employees e ON e.id = u.employee_id
      ORDER BY COALESCE(u.full_name, u.name, u.username, e.full_name) ASC
    `);

    const invitesByMeeting = invitesResult.rows.reduce((acc, row) => {
      if (!acc[row.meeting_id]) acc[row.meeting_id] = [];
      acc[row.meeting_id].push(mapInvite(row));
      return acc;
    }, {});

    return res.json({
      meetings: meetingsResult.rows.map((row) =>
        mapMeeting(row, invitesByMeeting[row.id] || [])
      ),
    });
  } catch (error) {
    console.error("GET /meetings/admin error:", error);
    return res.status(500).json({
      message: error.message || "Failed to load meetings",
    });
  }
});

router.get("/my", async (req, res) => {
  try {
    await ensureMeetingsTables();

    const result = await query(
      `
      SELECT
        m.*,
        mr.name AS room_name,
        COALESCE(c.full_name, c.name, c.username) AS created_by_name,
        mi.response_status,
        mi.response_note,
        mi.responded_at
      FROM meeting_invites mi
      INNER JOIN meetings m ON m.id = mi.meeting_id
      LEFT JOIN meeting_rooms mr ON mr.id = m.room_id
      LEFT JOIN users c ON c.id = m.created_by
      WHERE mi.user_id = $1
      ORDER BY m.meeting_date DESC, m.start_time DESC
      `,
      [req.user.id]
    );

    return res.json({
      meetings: result.rows.map((row) => ({
        id: row.id,
        title: row.title,
        agenda: row.agenda,
        meetingDate: row.meeting_date,
        startTime: row.start_time,
        endTime: row.end_time,
        location: row.location,
        meetingLink: row.meeting_link,
        priority: row.priority,
        status: row.status,
        roomId: row.room_id,
        roomName: row.room_name,
        createdByName: row.created_by_name,
        responseStatus: row.response_status,
        responseNote: row.response_note,
        respondedAt: row.responded_at,
      })),
    });
  } catch (error) {
    console.error("GET /meetings/my error:", error);
    return res.status(500).json({
      message: error.message || "Failed to load my meetings",
    });
  }
});

router.get("/:meetingId/access", async (req, res) => {
  try {
    await ensureMeetingsTables();

    const { meetingId } = req.params;

    if (isAdminUser(req.user)) {
      return res.json({ allowed: true, reason: "admin" });
    }

    const result = await query(
      `
      SELECT id
      FROM meeting_invites
      WHERE meeting_id = $1
        AND user_id = $2
      LIMIT 1
      `,
      [meetingId, req.user.id]
    );

    return res.json({
      allowed: result.rows.length > 0,
      reason: result.rows.length > 0 ? "invited" : "not_invited",
    });
  } catch (error) {
    console.error("GET /meetings/:meetingId/access error:", error);
    return res.status(500).json({
      message: error.message || "Failed to check access",
    });
  }
});

router.post("/", requireAdmin, async (req, res) => {
  try {
    await ensureMeetingsTables();

    const {
      title,
      agenda,
      meetingDate,
      startTime,
      endTime,
      location,
      meetingLink,
      priority = "normal",
      employeeUserIds = [],
      roomId = null,
    } = req.body || {};

    if (!title || !meetingDate || !startTime) {
      return res.status(400).json({
        message: "Title, date, and start time are required",
      });
    }

    if (!Array.isArray(employeeUserIds) || employeeUserIds.length === 0) {
      return res.status(400).json({
        message: "Please select at least one employee",
      });
    }

    const resolvedUserIds = await resolveSelectedEmployeeUserIds(employeeUserIds);

    if (!resolvedUserIds.length) {
      return res.status(400).json({
        message: "No valid user accounts found for selected employees",
      });
    }

    const meetingResult = await query(
      `
      INSERT INTO meetings (
        title,
        agenda,
        meeting_date,
        start_time,
        end_time,
        location,
        meeting_link,
        priority,
        status,
        room_id,
        created_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'scheduled',$9,$10)
      RETURNING *
      `,
      [
        String(title).trim(),
        agenda || null,
        meetingDate,
        startTime,
        endTime || null,
        location || null,
        meetingLink || null,
        priority || "normal",
        roomId || null,
        req.user.id,
      ]
    );

    const meeting = meetingResult.rows[0];

    for (const userId of resolvedUserIds) {
      await query(
        `
        INSERT INTO meeting_invites (meeting_id, user_id)
        VALUES ($1, $2)
        ON CONFLICT (meeting_id, user_id) DO NOTHING
        `,
        [meeting.id, userId]
      );
    }

    return res.status(201).json({
      message: "Meeting created successfully",
      meeting: mapMeeting(meeting),
    });
  } catch (error) {
    console.error("POST /meetings error:", error);
    return res.status(500).json({
      message: error.message || "Failed to create meeting",
    });
  }
});

router.patch("/:id/status", requireAdmin, async (req, res) => {
  try {
    await ensureMeetingsTables();

    const { id } = req.params;
    const { status } = req.body || {};

    const allowed = ["scheduled", "completed", "cancelled"];

    if (!allowed.includes(status)) {
      return res.status(400).json({
        message: "Invalid meeting status",
      });
    }

    const result = await query(
      `
      UPDATE meetings
      SET status = $1,
          updated_at = NOW()
      WHERE id = $2
      RETURNING *
      `,
      [status, id]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        message: "Meeting not found",
      });
    }

    return res.json({
      message: "Meeting status updated",
      meeting: mapMeeting(result.rows[0]),
    });
  } catch (error) {
    console.error("PATCH /meetings/:id/status error:", error);
    return res.status(500).json({
      message: error.message || "Failed to update status",
    });
  }
});

router.delete("/:meetingId", requireAdmin, async (req, res) => {
  try {
    await ensureMeetingsTables();

    const { meetingId } = req.params;

    const result = await query(
      `
      DELETE FROM meetings
      WHERE id = $1
      RETURNING id
      `,
      [meetingId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "Meeting not found" });
    }

    return res.json({
      message: "Meeting deleted successfully",
      id: meetingId,
    });
  } catch (error) {
    console.error("DELETE /meetings/:meetingId error:", error);
    return res.status(500).json({
      message: error.message || "Failed to delete meeting",
    });
  }
});

export default router;
