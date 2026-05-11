import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "change-this-in-production";

const rooms = new Map();

function getRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Map());
  }

  return rooms.get(roomId);
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
      id: decoded.sub || decoded.id || decoded.userId,
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
    socket.on("meeting:join", ({ meetingId }) => {
      if (!meetingId) return;

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
