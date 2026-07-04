const {
  createAnnotation,
  getAnnotations,
  addComment,
  resolveAnnotation,
} = require("../services/annotationService");

async function postAnnotation(req, res, next) {
  try {
    const { documentId, selectedText, note, startOffset, endOffset } = req.body;
    if (!documentId || !selectedText) {
      return res.status(400).json({ message: "documentId and selectedText are required" });
    }
    const annotation = await createAnnotation(req.user.id, {
      documentId,
      selectedText,
      note,
      startOffset,
      endOffset,
    });
    res.status(201).json({ annotation });
  } catch (err) {
    next(err);
  }
}

async function listAnnotations(req, res, next) {
  try {
    const annotations = await getAnnotations(req.params.documentId, req.user.id);
    res.json({ annotations });
  } catch (err) {
    next(err);
  }
}

async function postComment(req, res, next) {
  try {
    const { annotationId, comment, parentCommentId } = req.body;
    if (!annotationId || !comment) {
      return res.status(400).json({ message: "annotationId and comment are required" });
    }
    const newComment = await addComment(req.user.id, { annotationId, comment, parentCommentId });
    res.status(201).json({ comment: newComment });
  } catch (err) {
    next(err);
  }
}

async function resolveAnnotationHandler(req, res, next) {
  try {
    const annotation = await resolveAnnotation(req.user.id, req.params.annotationId);
    res.json({ annotation });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  postAnnotation,
  listAnnotations,
  postComment,
  resolveAnnotationHandler,
};
