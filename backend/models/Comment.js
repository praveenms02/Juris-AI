const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
  {
    annotationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Annotation",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    comment: { type: String, required: true },
    parentCommentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Comment", commentSchema);
