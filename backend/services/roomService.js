const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");
const DiscussionRoom = require("../models/DiscussionRoom");
const Document = require("../models/Document");
const User = require("../models/User");

// ── helpers ────────────────────────────────────────────────────────────────

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function makeInviteToken() {
  const token = uuidv4();
  return { token, tokenHash: hashToken(token) };
}

function isMember(room, userId) {
  const id = userId.toString();
  return room.participants.some((p) => p.userId.toString() === id);
}

function isOwner(room, userId) {
  return room.ownerId.toString() === userId.toString();
}

function assertAccess(room, userId) {
  if (room.visibility === "public") return;
  if (!isMember(room, userId)) {
    const err = new Error("Access denied — this is a private discussion room.");
    err.status = 403;
    throw err;
  }
}

// ── CRUD ───────────────────────────────────────────────────────────────────

/**
 * Create a room for a document. Owner is automatically added as a participant.
 * Throws if the document doesn't belong to the user.
 */
async function createRoom(ownerId, { documentId, title, visibility = "public" }) {
  // Ensure document exists and belongs to owner
  const doc = await Document.findOne({ _id: documentId, userId: ownerId });
  if (!doc) {
    const err = new Error("Document not found or you don't own it.");
    err.status = 404;
    throw err;
  }

  const existing = await DiscussionRoom.findOne({ documentId });
  if (existing) {
    const err = new Error("A discussion room already exists for this document.");
    err.status = 409;
    throw err;
  }

  const room = await DiscussionRoom.create({
    documentId,
    ownerId,
    title: title || doc.originalname,
    visibility,
    participants: [{ userId: ownerId, role: "owner" }],
  });

  return room.populate([
    { path: "ownerId", select: "name email" },
    { path: "documentId", select: "originalname filetype" },
    { path: "participants.userId", select: "name email" },
  ]);
}

/**
 * List all rooms the user owns or participates in.
 */
async function listRooms(userId) {
  return DiscussionRoom.find({
    $or: [{ ownerId: userId }, { "participants.userId": userId }],
  })
    .populate("documentId", "originalname filetype")
    .populate("ownerId", "name email")
    .sort({ updatedAt: -1 });
}

/**
 * List all public rooms (discovery).
 */
async function listPublicRooms({ limit = 30 } = {}) {
  return DiscussionRoom.find({ visibility: "public" })
    .populate("documentId", "originalname filetype")
    .populate("ownerId", "name email")
    .sort({ updatedAt: -1 })
    .limit(limit);
}

/**
 * Get a single room by ID, enforcing access control.
 */
async function getRoom(roomId, userId) {
  const room = await DiscussionRoom.findById(roomId)
    .populate("documentId", "originalname filetype extractedText clauses")
    .populate("ownerId", "name email")
    .populate("participants.userId", "name email");

  if (!room) {
    const err = new Error("Discussion room not found.");
    err.status = 404;
    throw err;
  }

  assertAccess(room, userId);
  return room;
}

/**
 * Get the room associated with a specific document.
 */
async function getRoomByDocument(documentId, userId) {
  const room = await DiscussionRoom.findOne({ documentId })
    .populate("documentId", "originalname filetype extractedText clauses")
    .populate("ownerId", "name email")
    .populate("participants.userId", "name email");

  if (!room) {
    const err = new Error("No discussion room found for this document.");
    err.status = 404;
    throw err;
  }

  assertAccess(room, userId);
  return room;
}

// ── Invite system ──────────────────────────────────────────────────────────

/**
 * Invite a user by email (or username).
 * Returns the plain token to be sent to the user (hashed version stored in DB).
 */
async function inviteUser(ownerId, roomId, emailOrUsername) {
  const room = await DiscussionRoom.findById(roomId);
  if (!room) {
    const err = new Error("Room not found."); err.status = 404; throw err;
  }
  if (!isOwner(room, ownerId)) {
    const err = new Error("Only the room owner can invite users."); err.status = 403; throw err;
  }

  // Resolve user
  const query = emailOrUsername.includes("@")
    ? { email: emailOrUsername.toLowerCase().trim() }
    : { name: new RegExp(`^${emailOrUsername.trim()}$`, "i") };

  const invitee = await User.findOne(query).select("_id name email");
  const resolvedEmail = invitee ? invitee.email : emailOrUsername.toLowerCase().trim();

  // Check already a participant
  if (invitee && isMember(room, invitee._id)) {
    const err = new Error("User is already a participant."); err.status = 409; throw err;
  }

  // Check pending invitation
  const pending = room.invitations.find(
    (i) => i.email === resolvedEmail && i.status === "pending"
  );
  if (pending) {
    const err = new Error("An invitation has already been sent to this user."); err.status = 409; throw err;
  }

  const { token, tokenHash } = makeInviteToken();
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

  room.invitations.push({
    email: resolvedEmail,
    invitedUserId: invitee?._id || null,
    status: "pending",
    token,          // plain token returned to caller (to embed in notification)
    tokenHash,
    expiresAt,
  });
  await room.save();

  return { token, invitee, resolvedEmail, room };
}

/**
 * Accept an invitation using the plain token.
 */
async function acceptInvitation(token, userId) {
  const tokenHash = hashToken(token);
  const now = new Date();

  const room = await DiscussionRoom.findOne({
    "invitations.tokenHash": tokenHash,
    "invitations.status": "pending",
  });

  if (!room) {
    const err = new Error("Invalid or expired invitation token."); err.status = 400; throw err;
  }

  const inv = room.invitations.find((i) => i.tokenHash === tokenHash);

  if (inv.expiresAt < now) {
    inv.status = "declined";
    await room.save();
    const err = new Error("Invitation has expired."); err.status = 400; throw err;
  }

  // Accept
  inv.status = "accepted";
  inv.invitedUserId = userId;

  // Add as participant if not already
  if (!isMember(room, userId)) {
    room.participants.push({ userId, role: "member" });
  }

  await room.save();
  return room;
}

// ── Participant management ─────────────────────────────────────────────────

async function removeParticipant(ownerId, roomId, targetUserId) {
  const room = await DiscussionRoom.findById(roomId);
  if (!room) { const e = new Error("Room not found."); e.status = 404; throw e; }
  if (!isOwner(room, ownerId)) { const e = new Error("Owner only."); e.status = 403; throw e; }
  if (targetUserId.toString() === ownerId.toString()) {
    const e = new Error("Owner cannot remove themselves."); e.status = 400; throw e;
  }

  room.participants = room.participants.filter(
    (p) => p.userId.toString() !== targetUserId.toString()
  );
  await room.save();
  return room;
}

async function changeVisibility(ownerId, roomId, visibility) {
  if (!["public", "private"].includes(visibility)) {
    const e = new Error("visibility must be 'public' or 'private'."); e.status = 400; throw e;
  }
  const room = await DiscussionRoom.findById(roomId);
  if (!room) { const e = new Error("Room not found."); e.status = 404; throw e; }
  if (!isOwner(room, ownerId)) { const e = new Error("Owner only."); e.status = 403; throw e; }

  room.visibility = visibility;
  await room.save();
  return room;
}

async function deleteRoom(ownerId, roomId) {
  const room = await DiscussionRoom.findById(roomId);
  if (!room) { const e = new Error("Room not found."); e.status = 404; throw e; }
  if (!isOwner(room, ownerId)) { const e = new Error("Owner only."); e.status = 403; throw e; }
  await room.deleteOne();
}

/**
 * Update online status for a participant.
 */
async function setParticipantOnline(roomId, userId, isOnline) {
  await DiscussionRoom.updateOne(
    { _id: roomId, "participants.userId": userId },
    {
      $set: {
        "participants.$.isOnline": isOnline,
        "participants.$.lastSeen": new Date(),
      },
    }
  );
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
  setParticipantOnline,
  isMember,
  isOwner,
};
