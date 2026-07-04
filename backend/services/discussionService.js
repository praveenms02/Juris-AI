const Discussion = require("../models/Discussion");
const Document = require("../models/Document");

const CATEGORIES = [
  "Contracts",
  "Rental Agreements",
  "Employment",
  "Legal Learning",
  "General Discussion",
];

async function createDiscussion(userId, { title, content, category, documentId }) {
  if (documentId) {
    const doc = await Document.findOne({ _id: documentId, userId });
    if (!doc) {
      throw new Error("Linked document not found");
    }
  }

  const cat = CATEGORIES.includes(category) ? category : "General Discussion";

  return Discussion.create({
    userId,
    title,
    content,
    category: cat,
    documentId: documentId || null,
  });
}

async function listDiscussions({ category, documentId, limit = 50 }) {
  const filter = {};
  if (category && CATEGORIES.includes(category)) {
    filter.category = category;
  }
  if (documentId) {
    filter.documentId = documentId;
  }

  return Discussion.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("userId", "name email")
    .populate("documentId", "originalname");
}

async function getDiscussion(discussionId) {
  const discussion = await Discussion.findById(discussionId)
    .populate("userId", "name email")
    .populate("documentId", "originalname")
    .populate("replies.userId", "name email");
  if (!discussion) {
    throw new Error("Discussion not found");
  }
  return discussion;
}

async function replyToDiscussion(userId, discussionId, content) {
  const discussion = await Discussion.findById(discussionId);
  if (!discussion) {
    throw new Error("Discussion not found");
  }

  discussion.replies.push({ userId, content });
  await discussion.save();
  return getDiscussion(discussionId);
}

module.exports = {
  CATEGORIES,
  createDiscussion,
  listDiscussions,
  getDiscussion,
  replyToDiscussion,
};
