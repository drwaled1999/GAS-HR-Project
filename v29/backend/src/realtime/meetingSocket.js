import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "change-this-in-production";

const rooms = new Map();

function getRoom(roomId) {
  if (!rooms.has(roomId)) rooms.set(roomId, new Map());
  return rooms.get(roomId);
}

function getUserFromToken(token) {
  if (!token) return null;

  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export function attachMeetingSocket(io) {
  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace("Bearer ", "");

    const user = getUserFromToken(token);

    if (!user) {
      return next(new Error("Unauthorized"));
    }

    socket.user = {
      id: user.sub || user.id,
      username: user.username,
      name: user.name || user.fullName || user.username || "User",
      role: user.role || user.roleName || user.roleCode || "User",
    };

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
