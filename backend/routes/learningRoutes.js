const express = require("express");
const { requireAuth } = require("../middleware/auth");
const {
  generateNotes,
  getNotes,
  exportNotesPdf,
  explainClause,
  generateQuiz,
  submitQuiz,
  getTopics,
  getDashboard,
} = require("../controllers/learningController");

const router = express.Router();
router.use(requireAuth);

router.get("/dashboard", getDashboard);
router.post("/notes/generate/:documentId", generateNotes);
router.get("/notes/:documentId", getNotes);
router.get("/notes/:documentId/export", exportNotesPdf);
router.post("/notes/explain/:documentId", explainClause);
router.post("/quiz/generate/:documentId", generateQuiz);
router.post("/quiz/submit", submitQuiz);
router.get("/topics/:documentId", getTopics);

module.exports = router;
