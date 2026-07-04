const mongoose = require("mongoose");

const annotationSchema = new mongoose.Schema(
  {
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    selectedText: { type: String, required: true },
    note: { type: String, default: "" },
    startOffset: { type: Number, default: 0 },
    endOffset: { type: Number, default: 0 },
    resolved: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Annotation", annotationSchema);
