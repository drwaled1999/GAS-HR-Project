import jwt from "jsonwebtoken";
import { query } from "../data/index.js";

const JWT_SECRET = process.env.JWT_SECRET || "change-this-in-production";
const rooms = new Map();

function getRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Map());
  }

  return rooms.get(roomId);
}

function normalizeRole(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function isAdminRole(role) {
  return [
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
  ].includes(normalizeRole(role));
}

function extractToken(socket) {
  const authToken = socket.handshake.auth?.token;

  const headerToken =
    socket.handshake.headers?.authorization ||
    socket.handshake.headers?.Authorization;

  const queryToken = socket.handshake.query?.token;

  const token = authToken || headerToken || queryToken || "";

  return String(token).replace("Bearer ", "").trim();
}

function getUserFromToken(token) {
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    return {
      id: decoded.id || decoded.sub || decoded.userId,
      username: decoded.username || decoded.email || decoded.name || "user",
      name:
        decoded.name ||
        decoded.fullName ||
        decoded.full_name ||
        decoded.username ||
        decoded.email ||
        "User",
      role:
        decoded.role ||
        decoded.roleName ||
        decoded.roleCode ||
        decoded.role_id ||
        "User",
    };
  } catch (error) {
    console.error("Socket JWT verify failed:", error.message);
    return null;
  }
}

async function canAccessMeeting(meetingId, user) {
  if (!meetingId || !user?.id) return false;

  if (isAdminRole(user.role)) {
    return true;
  }

  const result = await query(
    `
    SELECT id
    FROM meeting_invites
    WHERE meeting_id = $1
      AND user_id = $2
    LIMIT 1
    `,
    [meetingId, user.id]
  );

  return result.rows.length > 0;
}

export function attachMeetingSocket(io) {
  io.use((socket, next) => {
    const token = extractToken(socket);
    const user = getUserFromToken(token);

    if (!user?.id) {
      return next(new Error("Unauthorized"));
    }

    socket.user = user;
    next();
  });

  io.on("connection", (socket) => {
    socket.on("meeting:join", async ({ meetingId }) => {
      try {
        if (!meetingId) {
          socket.emit("meeting:error", {
            message: "Meeting ID is required",
          });
          return;
        }

        const allowed = await canAccessMeeting(meetingId, socket.user);

        if (!allowed) {
          socket.emit("meeting:error", {
            message: "Access denied to this meeting",
          });

          socket.disconnect();
          return;
        }

        const roomId = String(meetingId);
        const room = getRoom(roomId);

        socket.join(roomId);
        socket.meetingId = roomId;

        room.set(socket.id, {
          socketId: socket.id,
          userId: socket.user.id,
          name: socket.user.name,
          username: socket.user.username,
          role: socket.user.role,
          micOn: true,
          cameraOn: true,
        });

        const participants = Array.from(room.values());

        socket.emit("meeting:joined", {
          socketId: socket.id,
          participants,
        });

        socket.to(roomId).emit("meeting:user-joined", {
          socketId: socket.id,
          userId: socket.user.id,
          name: socket.user.name,
          username: socket.user.username,
          role: socket.user.role,
          micOn: true,
          cameraOn: true,
        });
      } catch (error) {
        console.error("meeting:join error:", error);

        socket.emit("meeting:error", {
          message: "Failed to join meeting",
        });
      }
    });

    socket.on("meeting:signal", ({ to, signal }) => {
      if (!to || !signal) return;

      io.to(to).emit("meeting:signal", {
        from: socket.id,
        signal,
        user: socket.user,
      });
    });

    socket.on("meeting:chat", ({ message }) => {
      const roomId = socket.meetingId;

      if (!roomId || !message?.trim()) return;

      io.to(roomId).emit("meeting:chat", {
        id: `${Date.now()}-${socket.id}`,
        message: String(message).trim(),
        sender: socket.user.name,
        senderId: socket.user.id,
        createdAt: new Date().toISOString(),
      });
    });

    socket.on("meeting:media-state", (state) => {
      const roomId = socket.meetingId;

      if (!roomId) return;

      const room = rooms.get(roomId);
      const participant = room?.get(socket.id);

      if (participant) {
        room.set(socket.id, {
          ...participant,
          ...state,
        });
      }

      socket.to(roomId).emit("meeting:media-state", {
        socketId: socket.id,
        ...state,
      });
    });

    socket.on("disconnect", () => {
      const roomId = socket.meetingId;

      if (!roomId) return;

      const room = rooms.get(roomId);

      if (room) {
        room.delete(socket.id);

        socket.to(roomId).emit("meeting:user-left", {
          socketId: socket.id,
        });

        if (room.size === 0) {
          rooms.delete(roomId);
        }
      }
    });
  });
}
