const express = require("express");
const { requireAuth } = require("../middleware/auth");
const {
  postDiscussion,
  getDiscussions,
  getDiscussionById,
  postReply,
} = require("../controllers/discussionController");

const router = express.Router();
router.use(requireAuth);

router.post("/", postDiscussion);
router.get("/", getDiscussions);
router.get("/:id", getDiscussionById);
router.post("/:id/reply", postReply);

module.exports = router;
