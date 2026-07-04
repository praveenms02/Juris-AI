const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { validateIntelligenceInput } = require("../middleware/validateInput");
const {
  getChatHistory,
  sendChatMessage,
  runIntelligenceMode,
  clearChatHistory,
} = require("../controllers/chatController");

const router = express.Router();

router.use(requireAuth);

router.post("/", validateIntelligenceInput, sendChatMessage);
router.post("/intelligence/:documentId", validateIntelligenceInput, runIntelligenceMode);
router.get("/:documentId", getChatHistory);
router.delete("/:documentId", clearChatHistory);

module.exports = router;
