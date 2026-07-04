const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { getJwtSecret } = require("../config/jwt");
const roomService = require("../services/roomService");
const roomMessageService = require("../services/roomMessageService");
const notificationService = require("../services/notificationService");
const DiscussionRoom = require("../models/DiscussionRoom");

// ── Socket.IO Auth Middleware ──────────────────────────────────────────────

async function authenticateSocket(socket, next) {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace("Bearer ", "");
    if (!token) {
      return next(new Error("Authentication required"));
    }
    const secret = getJwtSecret();
    const payload = jwt.verify(token, secret);
    const user = await User.findById(payload.sub).select("name email");
    if (!user) {
      return next(new Error("User not found"));
    }
    socket.user = { id: user._id.toString(), name: user.name, email: user.email };
    next();
  } catch (err) {
    next(new Error("Invalid or expired token"));
  }
}

// ── Typing state (in-memory, per room) ────────────────────────────────────
// roomId → Map<userId, timeoutId>
const typingTimeouts = new Map();

function setTyping(io, roomId, userId, userName, isTyping) {
  const key = `${roomId}:${userId}`;

  if (typingTimeouts.has(key)) {
    clearTimeout(typingTimeouts.get(key));
    typingTimeouts.delete(key);
  }

  if (isTyping) {
    io.to(`room:${roomId}`).emit("typing:update", { userId, userName, isTyping: true });
    // Auto-clear after 4 seconds
    const t = setTimeout(() => {
      io.to(`room:${roomId}`).emit("typing:update", { userId, userName, isTyping: false });
      typingTimeouts.delete(key);
    }, 4000);
    typingTimeouts.set(key, t);
  } else {
    io.to(`room:${roomId}`).emit("typing:update", { userId, userName, isTyping: false });
  }
}

// ── Room presence helpers ──────────────────────────────────────────────────

async function broadcastPresence(io, roomId) {
  const room = await DiscussionRoom.findById(roomId)
    .populate("participants.userId", "name email")
    .select("participants");

  if (room) {
    io.to(`room:${roomId}`).emit("presence:update", {
      participants: room.participants.map((p) => ({
        userId: p.userId._id || p.userId,
        name: p.userId.name || "User",
        role: p.role,
        isOnline: p.isOnline,
        lastSeen: p.lastSeen,
      })),
    });
  }
}

// ── Main handler ───────────────────────────────────────────────────────────

function registerRoomSocket(io) {
  // Apply auth middleware
  io.use(authenticateSocket);

  io.on("connection", (socket) => {
    const { id: userId, name: userName } = socket.user;

    // Each user joins their personal notification channel
    socket.join(`user:${userId}`);

    console.log(`[Socket] ${userName} connected — socket ${socket.id}`);

    // ── room:join ──────────────────────────────────────────────────────────
    socket.on("room:join", async ({ roomId }, callback) => {
      try {
        const room = await roomService.getRoom(roomId, userId);

        // Subscribe to the socket room
        socket.join(`room:${roomId}`);
        socket.currentRoomId = roomId;

        // Mark participant online
        await roomService.setParticipantOnline(roomId, userId, true);

        // Broadcast updated presence
        await broadcastPresence(io, roomId);

        // Send recent message history to the joiner
        const messages = await roomMessageService.getMessages(roomId, { limit: 50 });

        callback?.({ ok: true, messages, room: { _id: room._id, title: room.title, visibility: room.visibility } });

        // Announce join to the room
        io.to(`room:${roomId}`).emit("room:user_joined", {
          userId,
          userName,
          roomId,
        });

        console.log(`[Socket] ${userName} joined room ${roomId}`);
      } catch (err) {
        console.error("[Socket] room:join error:", err.message);
        callback?.({ ok: false, error: err.message });
      }
    });

    // ── room:leave ─────────────────────────────────────────────────────────
    socket.on("room:leave", async ({ roomId }) => {
      try {
        socket.leave(`room:${roomId}`);
        socket.currentRoomId = null;
        await roomService.setParticipantOnline(roomId, userId, false);
        await broadcastPresence(io, roomId);
        io.to(`room:${roomId}`).emit("room:user_left", { userId, userName, roomId });
        console.log(`[Socket] ${userName} left room ${roomId}`);
      } catch (err) {
        console.error("[Socket] room:leave error:", err.message);
      }
    });

    // ── message:send ───────────────────────────────────────────────────────
    socket.on("message:send", async ({ roomId, content, replyTo, sectionRef }, callback) => {
      try {
        // Verify access
        await roomService.getRoom(roomId, userId);

        const msg = await roomMessageService.saveUserMessage(roomId, {
          senderId: userId,
          senderName: userName,
          content,
          replyTo,
          sectionRef,
        });

        // Broadcast to room
        io.to(`room:${roomId}`).emit("message:new", msg);

        // Handle @mentions — notify mentioned users
        if (msg.mentions?.length) {
          const room = await DiscussionRoom.findById(roomId).populate("participants.userId", "name email");
          for (const mention of msg.mentions) {
            const participant = room.participants.find(
              (p) => (p.userId.name || "").toLowerCase() === mention.toLowerCase()
            );
            if (participant) {
              const mentionedId = participant.userId._id || participant.userId;
              await notificationService.createNotification(mentionedId, {
                type: "mention",
                roomId,
                payload: { mentionedBy: userName, message: content.slice(0, 120), roomId },
              });
              io.to(`user:${mentionedId}`).emit("notification:push", {
                type: "mention",
                message: `${userName} mentioned you in a discussion`,
                roomId,
              });
            }
          }
        }

        // Notify reply target (if any)
        if (replyTo) {
          const RoomMessage = require("../models/RoomMessage");
          const original = await RoomMessage.findById(replyTo).select("senderId");
          if (original?.senderId && original.senderId.toString() !== userId) {
            await notificationService.createNotification(original.senderId, {
              type: "reply",
              roomId,
              payload: { repliedBy: userName, message: content.slice(0, 120), roomId },
            });
            io.to(`user:${original.senderId}`).emit("notification:push", {
              type: "reply",
              message: `${userName} replied to your message`,
              roomId,
            });
          }
        }

        // Clear typing indicator
        setTyping(io, roomId, userId, userName, false);

        callback?.({ ok: true, message: msg });
      } catch (err) {
        console.error("[Socket] message:send error:", err.message);
        callback?.({ ok: false, error: err.message });
      }
    });

    // ── message:ai ─────────────────────────────────────────────────────────
    socket.on("message:ai", async ({ roomId, query, sectionRef }, callback) => {
      try {
        const room = await roomService.getRoom(roomId, userId);
        const documentId = room.documentId._id || room.documentId;
        const clauses = room.documentId?.clauses || [];

        // Emit typing indicator for AI
        io.to(`room:${roomId}`).emit("typing:update", { userId: "ai", userName: "JurisAI", isTyping: true });

        let aiResult;
        try {
          aiResult = await roomMessageService.queryAI({
            userId,
            documentId,
            query,
            roomId,
            clauses,
          });
        } catch (aiErr) {
          io.to(`room:${roomId}`).emit("typing:update", { userId: "ai", userName: "JurisAI", isTyping: false });
          callback?.({ ok: false, error: "AI service unavailable. Please try again." });
          return;
        }

        // Stop AI typing
        io.to(`room:${roomId}`).emit("typing:update", { userId: "ai", userName: "JurisAI", isTyping: false });

        // Save AI message
        const aiMsg = await roomMessageService.saveAIMessage(roomId, {
          content: aiResult.answer,
          sources: aiResult.sources || [],
          sectionRef,
        });

        // Broadcast AI response
        io.to(`room:${roomId}`).emit("message:new", aiMsg);

        callback?.({ ok: true, message: aiMsg });
      } catch (err) {
        console.error("[Socket] message:ai error:", err.message);
        callback?.({ ok: false, error: err.message });
      }
    });

    // ── typing:start / typing:stop ─────────────────────────────────────────
    socket.on("typing:start", ({ roomId }) => {
      setTyping(io, roomId, userId, userName, true);
    });

    socket.on("typing:stop", ({ roomId }) => {
      setTyping(io, roomId, userId, userName, false);
    });

    // ── disconnect ─────────────────────────────────────────────────────────
    socket.on("disconnect", async () => {
      console.log(`[Socket] ${userName} disconnected`);
      if (socket.currentRoomId) {
        try {
          await roomService.setParticipantOnline(socket.currentRoomId, userId, false);
          await broadcastPresence(io, socket.currentRoomId);
          io.to(`room:${socket.currentRoomId}`).emit("room:user_left", { userId, userName });
        } catch (e) {
          // ignore
        }
      }
    });
  });
}

module.exports = { registerRoomSocket };
