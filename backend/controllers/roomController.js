const roomService = require("../services/roomService");
const notificationService = require("../services/notificationService");
const roomMessageService = require("../services/roomMessageService");

// ── Room CRUD ──────────────────────────────────────────────────────────────

async function createRoom(req, res, next) {
  try {
    const { documentId, title, visibility } = req.body;
    if (!documentId) return res.status(400).json({ message: "documentId is required" });

    const room = await roomService.createRoom(req.user.id, { documentId, title, visibility });
    res.status(201).json({ room });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    next(err);
  }
}

async function listRooms(req, res, next) {
  try {
    const rooms = await roomService.listRooms(req.user.id);
    res.json({ rooms });
  } catch (err) {
    next(err);
  }
}

async function listPublicRooms(req, res, next) {
  try {
    const rooms = await roomService.listPublicRooms();
    res.json({ rooms });
  } catch (err) {
    next(err);
  }
}

async function getRoom(req, res, next) {
  try {
    const room = await roomService.getRoom(req.params.id, req.user.id);
    res.json({ room });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    next(err);
  }
}

async function getRoomByDocument(req, res, next) {
  try {
    const room = await roomService.getRoomByDocument(req.params.documentId, req.user.id);
    res.json({ room });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    next(err);
  }
}

// ── Invite system ──────────────────────────────────────────────────────────

async function inviteUser(req, res, next) {
  try {
    const { emailOrUsername } = req.body;
    if (!emailOrUsername) return res.status(400).json({ message: "emailOrUsername is required" });

    const { token, invitee, resolvedEmail, room } = await roomService.inviteUser(
      req.user.id,
      req.params.id,
      emailOrUsername
    );

    // Send in-app notification if the user exists
    if (invitee) {
      await notificationService.createNotification(invitee._id, {
        type: "invite",
        roomId: room._id,
        documentId: room.documentId,
        payload: {
          invitedBy: req.user.name,
          roomTitle: room.title,
          token,
          acceptUrl: `/rooms/join?token=${token}`,
        },
      });

      // Push real-time notification via Socket.IO (if available)
      const io = req.app.get("io");
      if (io) {
        io.to(`user:${invitee._id}`).emit("notification:push", {
          type: "invite",
          message: `${req.user.name} invited you to discuss "${room.title}"`,
          token,
          roomId: room._id,
        });
      }
    }

    res.json({
      message: invitee
        ? `Invitation sent to ${invitee.name} (${resolvedEmail})`
        : `Invitation created for ${resolvedEmail} (user not registered yet)`,
      inviteToken: token,
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    next(err);
  }
}

async function acceptInvitation(req, res, next) {
  try {
    const token = req.query.token || req.body.token;
    if (!token) return res.status(400).json({ message: "token is required" });

    const room = await roomService.acceptInvitation(token, req.user.id);

    // Notify the room owner
    await notificationService.createNotification(room.ownerId, {
      type: "room_joined",
      roomId: room._id,
      documentId: room.documentId,
      payload: {
        joinedUser: req.user.name,
        roomTitle: room.title,
      },
    });

    res.json({ message: "Invitation accepted! You have joined the room.", roomId: room._id });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    next(err);
  }
}

// ── Participant management ─────────────────────────────────────────────────

async function removeParticipant(req, res, next) {
  try {
    const room = await roomService.removeParticipant(
      req.user.id,
      req.params.id,
      req.params.userId
    );
    res.json({ message: "Participant removed.", room });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    next(err);
  }
}

async function changeVisibility(req, res, next) {
  try {
    const { visibility } = req.body;
    const room = await roomService.changeVisibility(req.user.id, req.params.id, visibility);
    res.json({ room });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    next(err);
  }
}

async function deleteRoom(req, res, next) {
  try {
    await roomService.deleteRoom(req.user.id, req.params.id);
    res.json({ message: "Discussion room deleted." });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    next(err);
  }
}

// ── Messages ───────────────────────────────────────────────────────────────

async function getMessages(req, res, next) {
  try {
    // Access check
    await roomService.getRoom(req.params.id, req.user.id);
    const { limit = 50, before } = req.query;
    const messages = await roomMessageService.getMessages(req.params.id, {
      limit: Math.min(Number(limit), 100),
      before,
    });
    res.json({ messages });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    next(err);
  }
}

// ── AI Summary ─────────────────────────────────────────────────────────────

async function generateSummary(req, res, next) {
  try {
    const room = await roomService.getRoom(req.params.id, req.user.id);

    const result = await roomMessageService.generateMeetingSummary({
      userId: req.user.id,
      documentId: room.documentId._id || room.documentId,
      roomId: room._id,
      clauses: room.documentId.clauses || [],
    });

    // Save as AI message
    const aiMsg = await roomMessageService.saveAIMessage(room._id, {
      content: `📋 **AI Meeting Summary**\n\n${result.summary}`,
      sources: result.sources,
    });

    // Notify all participants
    await notificationService.createNotification(room.ownerId, {
      type: "ai_summary",
      roomId: room._id,
      payload: { generatedAt: result.generatedAt },
    });

    // Broadcast via Socket.IO
    const io = req.app.get("io");
    if (io) {
      io.to(`room:${room._id}`).emit("message:new", aiMsg);
    }

    res.json({ summary: result });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    next(err);
  }
}

// ── Notifications ──────────────────────────────────────────────────────────

async function getNotifications(req, res, next) {
  try {
    const { unread } = req.query;
    const notifications = await notificationService.getNotifications(req.user.id, {
      unreadOnly: unread === "true",
    });
    const unreadCount = await notificationService.countUnread(req.user.id);
    res.json({ notifications, unreadCount });
  } catch (err) {
    next(err);
  }
}

async function markNotificationRead(req, res, next) {
  try {
    const n = await notificationService.markRead(req.user.id, req.params.notifId);
    res.json({ notification: n });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    next(err);
  }
}

async function markAllNotificationsRead(req, res, next) {
  try {
    await notificationService.markAllRead(req.user.id);
    res.json({ message: "All notifications marked as read." });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createRoom,
  listRooms,
  listPublicRooms,
  getRoom,
  getRoomByDocument,
  inviteUser,
  acceptInvitation,
  removeParticipant,
  changeVisibility,
  deleteRoom,
  getMessages,
  generateSummary,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
};
