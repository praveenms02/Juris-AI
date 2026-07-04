const express = require("express");
const { requireAuth } = require("../middleware/auth");
const {
  generateNotes,
  getNotes,
  exportNotesPdf,
  explainClause,
} = require("../controllers/learningController");

const router = express.Router();
router.use(requireAuth);

router.post("/generate/:documentId", generateNotes);
router.get("/:documentId/export", exportNotesPdf);
router.get("/:documentId", getNotes);
router.post("/explain/:documentId", explainClause);

module.exports = router;
