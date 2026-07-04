const RoomMessage = require("../models/RoomMessage");
const DiscussionRoom = require("../models/DiscussionRoom");
const { chatWithDocument } = require("./aiService");

// ── helpers ────────────────────────────────────────────────────────────────

function extractInitials(name = "") {
  return name
    .split(" ")
    .map((w) => w[0] || "")
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function sanitizeContent(text) {
  // Strip HTML tags and limit length
  return String(text)
    .replace(/<[^>]*>/g, "")
    .trim()
    .slice(0, 4000);
}

function extractMentions(text) {
  const matches = text.match(/@(\w+)/g) || [];
  return [...new Set(matches.map((m) => m.slice(1)))];
}

// ── Message persistence ────────────────────────────────────────────────────

/**
 * Save a user message to MongoDB.
 */
async function saveUserMessage(roomId, { senderId, senderName, content, replyTo, sectionRef }) {
  const clean = sanitizeContent(content);
  if (!clean) throw Object.assign(new Error("Message cannot be empty."), { status: 400 });

  const msg = await RoomMessage.create({
    roomId,
    senderId,
    senderName,
    senderInitials: extractInitials(senderName),
    role: "user",
    content: clean,
    mentions: extractMentions(clean),
    replyTo: replyTo || null,
    sectionRef: sectionRef || null,
  });

  // Increment message count
  await DiscussionRoom.updateOne({ _id: roomId }, { $inc: { messageCount: 1 } });

  return msg;
}

/**
 * Save an AI response to MongoDB.
 */
async function saveAIMessage(roomId, { content, sources = [], sectionRef }) {
  const msg = await RoomMessage.create({
    roomId,
    senderId: null,
    senderName: "JurisAI",
    senderInitials: "AI",
    role: "ai",
    content: sanitizeContent(content),
    sources,
    sectionRef: sectionRef || null,
  });

  await DiscussionRoom.updateOne({ _id: roomId }, { $inc: { messageCount: 1 } });
  return msg;
}

/**
 * Retrieve paginated message history for a room.
 */
async function getMessages(roomId, { limit = 50, before } = {}) {
  const filter = { roomId, isDeleted: false };
  if (before) {
    filter.createdAt = { $lt: new Date(before) };
  }

  const messages = await RoomMessage.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("senderId", "name email")
    .populate("replyTo", "content senderName");

  return messages.reverse(); // return in chronological order
}

// ── AI participation ───────────────────────────────────────────────────────

/**
 * Get recent room message history formatted for AI context.
 */
async function buildChatHistoryForAI(roomId, limit = 8) {
  const messages = await RoomMessage.find({ roomId, isDeleted: false })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select("role content senderName");

  return messages.reverse().map((m) => ({
    role: m.role === "ai" ? "ai" : "user",
    content: m.role === "user" ? `${m.senderName}: ${m.content}` : m.content,
  }));
}

/**
 * Call AI RAG and return the response (does NOT save — caller saves via saveAIMessage).
 */
async function queryAI({ userId, documentId, query, roomId, clauses = [] }) {
  const chatHistory = await buildChatHistoryForAI(roomId);

  const result = await chatWithDocument({
    userId: userId.toString(),
    documentId: documentId.toString(),
    query,
    chatHistory,
    clauses,
    topK: 5,
  });

  return result; // { answer, sources, related_excerpt }
}

// ── AI Meeting Summary ─────────────────────────────────────────────────────

/**
 * Generate a structured meeting summary from recent discussion messages.
 */
async function generateMeetingSummary({ userId, documentId, roomId, clauses = [] }) {
  // Fetch last 100 messages
  const messages = await RoomMessage.find({ roomId, isDeleted: false })
    .sort({ createdAt: -1 })
    .limit(100)
    .select("role content senderName createdAt");

  const reversed = messages.reverse();

  if (reversed.length === 0) {
    return { summary: "No messages in this discussion yet." };
  }

  // Build a transcript
  const transcript = reversed
    .map((m) => `[${m.senderName}]: ${m.content}`)
    .join("\n");

  const summaryQuery = `Based on the following discussion transcript from a legal document review session, 
provide a structured summary with these sections:
1. Main Discussion Points
2. Important Legal Conclusions
3. Open Questions
4. Action Items
5. Decisions Made

Discussion Transcript:
${transcript.slice(0, 8000)}`;

  const result = await chatWithDocument({
    userId: userId.toString(),
    documentId: documentId.toString(),
    query: summaryQuery,
    chatHistory: [],
    clauses,
    topK: 5,
  });

  return {
    summary: result.answer,
    sources: result.sources || [],
    messageCount: reversed.length,
    generatedAt: new Date(),
  };
}

module.exports = {
  saveUserMessage,
  saveAIMessage,
  getMessages,
  queryAI,
  generateMeetingSummary,
};
