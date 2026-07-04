const mongoose = require("mongoose");

const quizSchema = new mongoose.Schema(
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
    questions: { type: [mongoose.Schema.Types.Mixed], default: [] },
    questionCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Quiz", quizSchema);
