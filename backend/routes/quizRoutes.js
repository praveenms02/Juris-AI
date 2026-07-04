const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { generateQuiz, submitQuiz } = require("../controllers/learningController");

const router = express.Router();
router.use(requireAuth);

router.post("/generate/:documentId", generateQuiz);
router.post("/submit", submitQuiz);

module.exports = router;
