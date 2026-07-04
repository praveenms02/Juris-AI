const axios = require("axios");

function getAiBaseUrl() {
  return (process.env.AI_SERVICE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
}

/**
 * Phase 1 — extract, chunk, embed.
 */
async function processDocument({ filePath, userId, documentId, originalname, createReadStream }) {
  const FormData = require("form-data");
  const form = new FormData();
  form.append("user_id", userId);
  form.append("document_id", documentId);
  form.append("filename", originalname);
  form.append("file", createReadStream(filePath), {
    filename: require("path").basename(filePath),
    contentType: "application/octet-stream",
  });

  const response = await axios.post(`${getAiBaseUrl()}/process-document`, form, {
    headers: form.getHeaders(),
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    timeout: 10 * 60 * 1000,
  });

  return response.data;
}

/**
 * Phase 2 — summarize, NER, clauses, simplification.
 */
async function analyzeDocument({ documentId, extractedText, explanationMode = "normal" }) {
  const response = await axios.post(
    `${getAiBaseUrl()}/analyze-document`,
    {
      document_id: documentId,
      extracted_text: extractedText,
      explanation_mode: explanationMode,
    },
    {
      timeout: 15 * 60 * 1000,
      headers: { "Content-Type": "application/json" },
    }
  );

  return response.data;
}

/**
 * Phase 3 — Legal Q&A (top-5 RAG, citations, memory).
 */
async function chatWithDocument({
  userId,
  documentId,
  query,
  chatHistory = [],
  clauses = [],
  topK = 5,
}) {
  const response = await axios.post(
    `${getAiBaseUrl()}/chat`,
    {
      user_id: userId,
      document_id: documentId,
      query,
      chat_history: chatHistory,
      clauses,
      top_k: topK,
    },
    {
      timeout: 5 * 60 * 1000,
      headers: { "Content-Type": "application/json" },
    }
  );

  return response.data;
}

/**
 * Document intelligence modes — explain, study, quiz, topics.
 */
async function runIntelligence({
  userId,
  documentId,
  mode,
  query = "",
  chatHistory = [],
  extractedText = "",
  documentSummary = "",
  shortSummary = "",
  entities = {},
  clauses = [],
  risks = [],
  topK = 5,
}) {
  const response = await axios.post(
    `${getAiBaseUrl()}/intelligence`,
    {
      user_id: userId,
      document_id: documentId,
      mode,
      query,
      chat_history: chatHistory,
      extracted_text: extractedText,
      document_summary: documentSummary,
      short_summary: shortSummary,
      entities,
      clauses,
      risks,
      top_k: topK,
    },
    {
      timeout: 10 * 60 * 1000,
      headers: { "Content-Type": "application/json" },
    }
  );

  return response.data;
}

async function purgeDocument(documentId) {
  try {
    await axios.post(
      `${getAiBaseUrl()}/purge-document`,
      { document_id: documentId },
      { timeout: 60 * 1000 }
    );
  } catch (err) {
    console.warn("AI purge failed (vectors may be orphaned):", err.message);
  }
}

/** Phase 5 — study notes generation */
async function generateStudyNotes({
  documentId,
  extractedText,
  summary,
  shortSummary,
  clauses,
  entities,
  noteType = "revision",
}) {
  const response = await axios.post(
    `${getAiBaseUrl()}/generate-study-notes`,
    {
      document_id: documentId,
      extracted_text: extractedText,
      summary: summary || "",
      short_summary: shortSummary || "",
      clauses: clauses || [],
      entities: entities || {},
      note_type: noteType,
    },
    { timeout: 5 * 60 * 1000, headers: { "Content-Type": "application/json" } }
  );
  return response.data;
}

/** Phase 5 — clause explanation */
async function explainClause({ clauseText, clauseTitle }) {
  const response = await axios.post(
    `${getAiBaseUrl()}/explain-clause`,
    { clause_text: clauseText, clause_title: clauseTitle || "Clause" },
    { timeout: 2 * 60 * 1000, headers: { "Content-Type": "application/json" } }
  );
  return response.data;
}

/** Phase 5 — quiz generation */
async function generateQuiz({ documentId, extractedText, clauses, entities, numQuestions = 8 }) {
  const response = await axios.post(
    `${getAiBaseUrl()}/generate-quiz`,
    {
      document_id: documentId,
      extracted_text: extractedText,
      clauses: clauses || [],
      entities: entities || {},
      num_questions: numQuestions,
    },
    { timeout: 5 * 60 * 1000, headers: { "Content-Type": "application/json" } }
  );
  return response.data;
}

/** Phase 5 — quiz evaluation */
async function evaluateQuiz({ questions, answers }) {
  const response = await axios.post(
    `${getAiBaseUrl()}/evaluate-quiz`,
    { questions, answers },
    { timeout: 2 * 60 * 1000, headers: { "Content-Type": "application/json" } }
  );
  return response.data;
}

/** Phase 5 — learning topic suggestions */
async function suggestLearningTopics({ extractedText, clauses, entities }) {
  const response = await axios.post(
    `${getAiBaseUrl()}/suggest-learning-topics`,
    {
      extracted_text: extractedText || "",
      clauses: clauses || [],
      entities: entities || {},
    },
    { timeout: 2 * 60 * 1000, headers: { "Content-Type": "application/json" } }
  );
  return response.data;
}

module.exports = {
  processDocument,
  analyzeDocument,
  chatWithDocument,
  runIntelligence,
  purgeDocument,
  generateStudyNotes,
  explainClause,
  generateQuiz,
  evaluateQuiz,
  suggestLearningTopics,
};
