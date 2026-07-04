const Document = require("../models/Document");
const Chat = require("../models/Chat");
const { chatWithDocument, runIntelligence } = require("../services/aiService");

async function getOwnedDocument(userId, documentId) {
  const doc = await Document.findOne({ _id: documentId, userId });
  if (!doc) {
    const err = new Error("Document not found");
    err.status = 404;
    throw err;
  }
  if (doc.processingStatus !== "completed") {
    const err = new Error("Document must be fully processed.");
    err.status = 400;
    throw err;
  }
  if (!doc.chunkCount || doc.chunkCount < 1) {
    const err = new Error("No indexed chunks found for this document.");
    err.status = 400;
    throw err;
  }
  return doc;
}

function docPayload(doc) {
  return {
    extractedText: doc.extractedText || "",
    documentSummary: doc.shortSummary || doc.summary || "",
    shortSummary: doc.shortSummary || "",
    entities: doc.entities || {},
    clauses: doc.clauses || [],
    risks: doc.risks || [],
  };
}

/**
 * GET /api/chat/:documentId — load chat history + full document for intelligence UI.
 */
async function getChatHistory(req, res, next) {
  try {
    const { documentId } = req.params;
    const doc = await Document.findOne({ _id: documentId, userId: req.user.id });
    if (!doc) {
      return res.status(404).json({ message: "Document not found" });
    }

    const chat = await Chat.findOne({ userId: req.user.id, documentId });

    res.json({
      chat: chat || { messages: [] },
      document: {
        _id: doc._id,
        originalname: doc.originalname,
        filetype: doc.filetype,
        extractedText: doc.extractedText,
        shortSummary: doc.shortSummary,
        summary: doc.summary,
        entities: doc.entities,
        clauses: doc.clauses,
        risks: doc.risks,
        analysisStatus: doc.analysisStatus,
        processingStatus: doc.processingStatus,
        chunkCount: doc.chunkCount,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/chat — Legal Q&A only.
 */
async function sendChatMessage(req, res, next) {
  try {
    const { documentId, query } = req.body;
    if (!documentId) {
      return res.status(400).json({ message: "documentId is required" });
    }
    if (!query || !String(query).trim()) {
      return res.status(400).json({ message: "Query cannot be empty" });
    }

    const doc = await getOwnedDocument(req.user.id, documentId);
    let chat = await Chat.findOne({ userId: req.user.id, documentId });
    if (!chat) {
      chat = await Chat.create({ userId: req.user.id, documentId, messages: [] });
    }

    const historyForAi = chat.messages.slice(-8).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const trimmedQuery = String(query).trim();
    const payload = docPayload(doc);

    let aiResult;
    try {
      aiResult = await chatWithDocument({
        userId: req.user.id.toString(),
        documentId: documentId.toString(),
        query: trimmedQuery,
        chatHistory: historyForAi,
        clauses: payload.clauses,
        topK: 5,
      });
    } catch (err) {
      const detail = err.response?.data?.detail || err.message;
      return res.status(502).json({
        message: "AI chat service failed.",
        aiError: typeof detail === "string" ? detail : JSON.stringify(detail),
      });
    }

    const userMessage = {
      role: "user",
      content: trimmedQuery,
      sources: [],
      timestamp: new Date(),
    };

    const aiMessage = {
      role: "ai",
      content: aiResult.answer,
      sources: aiResult.sources || [],
      relatedExcerpt: aiResult.related_excerpt || "",
      timestamp: new Date(),
    };

    chat.messages.push(userMessage, aiMessage);
    await chat.save();

    res.json({
      mode: "legal",
      answer: aiMessage.content,
      sources: aiMessage.sources,
      relatedExcerpt: aiMessage.relatedExcerpt,
      messages: chat.messages,
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ message: err.message });
    }
    next(err);
  }
}

/**
 * POST /api/intelligence/:documentId — mode-specific intelligence (explain/study/quiz/topics).
 */
async function runIntelligenceMode(req, res, next) {
  try {
    const { documentId } = req.params;
    const mode = req.body?.mode || req.params?.mode;
    if (!mode || mode === "legal") {
      return res.status(400).json({ message: "Use POST /api/chat for Legal Q&A." });
    }

    const doc = await getOwnedDocument(req.user.id, documentId);
    const payload = docPayload(doc);

    let result;
    try {
      result = await runIntelligence({
        userId: req.user.id.toString(),
        documentId: documentId.toString(),
        mode,
        query: req.body?.query || "",
        chatHistory: [],
        ...payload,
        topK: 5,
      });
    } catch (err) {
      const detail = err.response?.data?.detail || err.message;
      return res.status(502).json({
        message: "Intelligence service failed.",
        aiError: typeof detail === "string" ? detail : JSON.stringify(detail),
      });
    }

    res.json(result);
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ message: err.message });
    }
    next(err);
  }
}

async function clearChatHistory(req, res, next) {
  try {
    const { documentId } = req.params;
    const doc = await Document.findOne({ _id: documentId, userId: req.user.id });
    if (!doc) {
      return res.status(404).json({ message: "Document not found" });
    }
    await Chat.findOneAndUpdate(
      { userId: req.user.id, documentId },
      { $set: { messages: [] } },
      { upsert: true }
    );
    res.json({ message: "Chat history cleared" });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getChatHistory,
  sendChatMessage,
  runIntelligenceMode,
  clearChatHistory,
};
