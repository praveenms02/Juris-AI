const {
  generateNotesForDocument,
  getNotesForDocument,
  explainClauseForDocument,
  createQuizForDocument,
  submitQuizAttempt,
  getLearningTopics,
  getLearningDashboard,
} = require("../services/learningService");

async function generateNotes(req, res, next) {
  try {
    const { documentId } = req.params;
    const noteType = req.body?.noteType || "revision";
    const note = await generateNotesForDocument(req.user.id, documentId, noteType);
    res.status(201).json({ note });
  } catch (err) {
    next(err);
  }
}

async function getNotes(req, res, next) {
  try {
    const notes = await getNotesForDocument(req.user.id, req.params.documentId);
    res.json({ notes });
  } catch (err) {
    next(err);
  }
}

async function exportNotesPdf(req, res, next) {
  try {
    const notes = await getNotesForDocument(req.user.id, req.params.documentId);
    const note = notes[0];
    if (!note) {
      return res.status(404).json({ message: "No notes found. Generate notes first." });
    }
    const filename = `jurisai-notes-${req.params.documentId}.txt`;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(`${note.title}\n\n${note.content}`);
  } catch (err) {
    next(err);
  }
}

async function explainClause(req, res, next) {
  try {
    const { clauseText, clauseTitle } = req.body;
    if (!clauseText) {
      return res.status(400).json({ message: "clauseText is required" });
    }
    const explanation = await explainClauseForDocument(
      req.user.id,
      req.params.documentId,
      clauseText,
      clauseTitle
    );
    res.json({ explanation });
  } catch (err) {
    next(err);
  }
}

async function generateQuiz(req, res, next) {
  try {
    const numQuestions = Number(req.body?.numQuestions || 8);
    const quiz = await createQuizForDocument(req.user.id, req.params.documentId, numQuestions);
    res.status(201).json({ quiz });
  } catch (err) {
    next(err);
  }
}

async function submitQuiz(req, res, next) {
  try {
    const { quizId, answers } = req.body;
    if (!quizId || !Array.isArray(answers)) {
      return res.status(400).json({ message: "quizId and answers are required" });
    }
    const result = await submitQuizAttempt(req.user.id, quizId, answers);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getTopics(req, res, next) {
  try {
    const topics = await getLearningTopics(req.user.id, req.params.documentId);
    res.json({ topics });
  } catch (err) {
    next(err);
  }
}

async function getDashboard(req, res, next) {
  try {
    const dashboard = await getLearningDashboard(req.user.id);
    res.json({ dashboard });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  generateNotes,
  getNotes,
  exportNotesPdf,
  explainClause,
  generateQuiz,
  submitQuiz,
  getTopics,
  getDashboard,
};
