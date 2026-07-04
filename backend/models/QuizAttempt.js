const mongoose = require("mongoose");

const quizAttemptSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    quizId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Quiz",
      required: true,
      index: true,
    },
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
      index: true,
    },
    score: { type: Number, default: 0 },
    correctCount: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    answers: { type: [mongoose.Schema.Types.Mixed], default: [] },
    results: { type: [mongoose.Schema.Types.Mixed], default: [] },
    completedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("QuizAttempt", quizAttemptSchema);
