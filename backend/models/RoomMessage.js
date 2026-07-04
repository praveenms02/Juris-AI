const mongoose = require("mongoose");

/**
 * Persisted chat message for a discussion room.
 * Covers: user messages, AI RAG replies, section-anchored comments.
 */
const roomMessageSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DiscussionRoom",
      required: true,
      index: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,         // null for AI messages
    },
    senderName: { type: String, required: true },   // denormalized for speed
    senderInitials: { type: String, default: "" },  // e.g. "JD" for John Doe
    role: { type: String, enum: ["user", "ai"], required: true },
    content: { type: String, required: true },
    mentions: { type: [String], default: [] },       // @username strings
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RoomMessage",
      default: null,
    },
    // AI-specific fields
    sources: { type: [mongoose.Schema.Types.Mixed], default: [] },
    // Section-anchored comment (optional)
    sectionRef: {
      clauseIndex: { type: Number },
      clauseTitle: { type: String },
      excerpt: { type: String },
    },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// For paginated history retrieval
roomMessageSchema.index({ roomId: 1, createdAt: -1 });

module.exports = mongoose.model("RoomMessage", roomMessageSchema);
