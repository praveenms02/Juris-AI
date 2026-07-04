const {
  createDiscussion,
  listDiscussions,
  getDiscussion,
  replyToDiscussion,
  CATEGORIES,
} = require("../services/discussionService");

async function postDiscussion(req, res, next) {
  try {
    const { title, content, category, documentId } = req.body;
    if (!title || !content) {
      return res.status(400).json({ message: "title and content are required" });
    }
    const discussion = await createDiscussion(req.user.id, {
      title,
      content,
      category,
      documentId,
    });
    res.status(201).json({ discussion });
  } catch (err) {
    next(err);
  }
}

async function getDiscussions(req, res, next) {
  try {
    const discussions = await listDiscussions({
      category: req.query.category,
      documentId: req.query.documentId,
    });
    res.json({ discussions, categories: CATEGORIES });
  } catch (err) {
    next(err);
  }
}

async function getDiscussionById(req, res, next) {
  try {
    const discussion = await getDiscussion(req.params.id);
    res.json({ discussion });
  } catch (err) {
    next(err);
  }
}

async function postReply(req, res, next) {
  try {
    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ message: "content is required" });
    }
    const discussion = await replyToDiscussion(req.user.id, req.params.id, content);
    res.json({ discussion });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  postDiscussion,
  getDiscussions,
  getDiscussionById,
  postReply,
};
