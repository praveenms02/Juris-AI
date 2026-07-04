const Document = require("../models/Document");
const Annotation = require("../models/Annotation");
const Comment = require("../models/Comment");

async function getOwnedDocument(userId, documentId) {
  const doc = await Document.findOne({ _id: documentId, userId });
  if (!doc) {
    throw new Error("Document not found");
  }
  return doc;
}

async function createAnnotation(userId, { documentId, selectedText, note, startOffset, endOffset }) {
  await getOwnedDocument(userId, documentId);
  return Annotation.create({
    documentId,
    userId,
    selectedText,
    note: note || "",
    startOffset: startOffset || 0,
    endOffset: endOffset || 0,
  });
}

async function getAnnotations(documentId, userId) {
  await getOwnedDocument(userId, documentId);
  const annotations = await Annotation.find({ documentId }).sort({ createdAt: -1 }).lean();

  const withComments = await Promise.all(
    annotations.map(async (ann) => {
      const comments = await Comment.find({ annotationId: ann._id })
        .sort({ createdAt: 1 })
        .populate("userId", "name email")
        .lean();
      return { ...ann, comments };
    })
  );

  return withComments;
}

async function addComment(userId, { annotationId, comment, parentCommentId }) {
  const annotation = await Annotation.findById(annotationId);
  if (!annotation) {
    throw new Error("Annotation not found");
  }
  await getOwnedDocument(userId, annotation.documentId);

  return Comment.create({
    annotationId,
    userId,
    comment,
    parentCommentId: parentCommentId || null,
  });
}

async function resolveAnnotation(userId, annotationId) {
  const annotation = await Annotation.findById(annotationId);
  if (!annotation) {
    throw new Error("Annotation not found");
  }
  await getOwnedDocument(userId, annotation.documentId);
  annotation.resolved = true;
  await annotation.save();
  return annotation;
}

module.exports = {
  createAnnotation,
  getAnnotations,
  addComment,
  resolveAnnotation,
};
