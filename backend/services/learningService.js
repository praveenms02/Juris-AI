const Document = require("../models/Document");
const Note = require("../models/Note");
const Quiz = require("../models/Quiz");
const QuizAttempt = require("../models/QuizAttempt");
const {
  generateStudyNotes,
  explainClause,
  generateQuiz,
  evaluateQuiz,
  suggestLearningTopics,
} = require("./aiService");

async function getOwnedDocument(userId, documentId) {
  const doc = await Document.findOne({ _id: documentId, userId });
  if (!doc) {
    throw new Error("Document not found");
  }
  if (doc.processingStatus !== "completed") {
    throw new Error("Document must be fully processed");
  }
  return doc;
}

async function generateNotesForDocument(userId, documentId, noteType = "revision") {
  const doc = await getOwnedDocument(userId, documentId);
  const extracted = (doc.extractedText || "").trim();
  if (!extracted) {
    throw new Error("No extracted text available");
  }

  const ai = await generateStudyNotes({
    documentId: doc._id.toString(),
    extractedText: extracted,
    summary: doc.summary,
    shortSummary: doc.shortSummary,
    clauses: doc.clauses,
    entities: doc.entities,
    noteType,
  });

  const note = await Note.findOneAndUpdate(
    { userId, documentId, noteType },
    {
      userId,
      documentId,
      title: ai.title,
      noteType,
      content: ai.content,
      sections: ai.sections || {},
    },
    { upsert: true, new: true }
  );

  return note;
}

async function getNotesForDocument(userId, documentId) {
  await getOwnedDocument(userId, documentId);
  return Note.find({ userId, documentId }).sort({ updatedAt: -1 });
}

async function explainClauseForDocument(userId, documentId, clauseText, clauseTitle) {
  await getOwnedDocument(userId, documentId);
  return explainClause({ clauseText, clauseTitle });
}

async function createQuizForDocument(userId, documentId, numQuestions = 8) {
  const doc = await getOwnedDocument(userId, documentId);
  const extracted = (doc.extractedText || "").trim();
  if (!extracted) {
    throw new Error("No extracted text available");
  }

  const ai = await generateQuiz({
    documentId: doc._id.toString(),
    extractedText: extracted,
    clauses: doc.clauses,
    entities: doc.entities,
    numQuestions,
  });

  const quiz = await Quiz.create({
    documentId,
    userId,
    questions: ai.questions,
    questionCount: ai.question_count,
  });

  return quiz;
}

async function submitQuizAttempt(userId, quizId, answers) {
  const quiz = await Quiz.findById(quizId);
  if (!quiz) {
    throw new Error("Quiz not found");
  }
  if (quiz.userId.toString() !== userId.toString()) {
    throw new Error("Quiz not found");
  }

  const result = await evaluateQuiz({
    questions: quiz.questions,
    answers,
  });

  const attempt = await QuizAttempt.create({
    userId,
    quizId,
    documentId: quiz.documentId,
    score: result.score,
    correctCount: result.correct_count,
    total: result.total,
    answers,
    results: result.results,
  });

  return { attempt, evaluation: result };
}

async function getLearningTopics(userId, documentId) {
  const doc = await getOwnedDocument(userId, documentId);
  const ai = await suggestLearningTopics({
    extractedText: doc.extractedText,
    clauses: doc.clauses,
    entities: doc.entities,
  });
  return ai.topics || [];
}

async function getLearningDashboard(userId) {
  const [documents, notes, attempts, quizzes] = await Promise.all([
    Document.countDocuments({ userId, processingStatus: "completed" }),
    Note.countDocuments({ userId }),
    QuizAttempt.find({ userId }).sort({ completedAt: -1 }).limit(10).populate("documentId", "originalname"),
    Quiz.countDocuments({ userId }),
  ]);

  const avgScore =
    attempts.length > 0
      ? Math.round(attempts.reduce((s, a) => s + (a.score || 0), 0) / attempts.length)
      : 0;

  return {
    documentsStudied: documents,
    notesGenerated: notes,
    quizzesTaken: attempts.length,
    quizzesAvailable: quizzes,
    averageQuizScore: avgScore,
    recentAttempts: attempts,
  };
}

module.exports = {
  generateNotesForDocument,
  getNotesForDocument,
  explainClauseForDocument,
  createQuizForDocument,
  submitQuizAttempt,
  getLearningTopics,
  getLearningDashboard,
};
