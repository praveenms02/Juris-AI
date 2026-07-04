const mongoose = require("mongoose");

const noteSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
      required: true,
      index: true,
    },
    title: { type: String, required: true },
    noteType: {
      type: String,
      enum: ["revision", "exam", "quick_reference", "key_takeaways"],
      default: "revision",
    },
    content: { type: String, default: "" },
    sections: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
  },
  { timestamps: true }
);

noteSchema.index({ userId: 1, documentId: 1, noteType: 1 });

module.exports = mongoose.model("Note", noteSchema);
