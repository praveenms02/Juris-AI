const mongoose = require("mongoose");

const invitationSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    invitedUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    status: { type: String, enum: ["pending", "accepted", "declined"], default: "pending" },
    token: { type: String, required: true },          // hashed UUID sent in invite link
    tokenHash: { type: String, required: true },      // SHA-256 of token — stored in DB
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

const participantSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: String, enum: ["owner", "member"], default: "member" },
    joinedAt: { type: Date, default: Date.now },
    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date, default: Date.now },
  },
  { _id: false }
);

const discussionRoomSchema = new mongoose.Schema(
  {
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
      required: true,
      unique: true,    // one room per document
      index: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    visibility: {
      type: String,
      enum: ["public", "private"],
      default: "public",
    },
    participants: { type: [participantSchema], default: [] },
    invitations: { type: [invitationSchema], default: [] },
    messageCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Compound index for efficient participant look-up
discussionRoomSchema.index({ "participants.userId": 1 });

module.exports = mongoose.model("DiscussionRoom", discussionRoomSchema);
