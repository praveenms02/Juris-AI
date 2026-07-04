const express = require("express");
const { requireAuth } = require("../middleware/auth");
const {
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
} = require("../controllers/roomController");

const router = express.Router();
router.use(requireAuth);

// ── Room CRUD ──────────────────────────────────────────────────────────────
router.post("/", createRoom);
router.get("/", listRooms);
router.get("/public", listPublicRooms);
router.get("/document/:documentId", getRoomByDocument);
router.get("/:id", getRoom);
router.delete("/:id", deleteRoom);

// ── Settings ───────────────────────────────────────────────────────────────
router.patch("/:id/visibility", changeVisibility);

// ── Invitations ────────────────────────────────────────────────────────────
router.post("/:id/invite", inviteUser);
router.post("/join/accept", acceptInvitation);          // POST /api/rooms/join/accept?token=...

// ── Participants ───────────────────────────────────────────────────────────
router.delete("/:id/participants/:userId", removeParticipant);

// ── Messages ───────────────────────────────────────────────────────────────
router.get("/:id/messages", getMessages);

// ── AI Summary ─────────────────────────────────────────────────────────────
router.post("/:id/summary", generateSummary);

module.exports = router;
