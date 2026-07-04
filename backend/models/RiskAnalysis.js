const mongoose = require('mongoose');

const riskAnalysisSchema = new mongoose.Schema(
  {
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    overallRiskScore: {
      type: Number,
      min: 0,
      max: 100,
      required: true,
    },
    riskLevel: {
      type: String,
      enum: ['Low', 'Medium', 'High'],
      required: true,
    },
    riskBreakdown: {
      clauseRisk: Number,
      missingClauses: Number,
      riskyLanguage: Number,
      financialRisk: Number,
    },
    clauseRisks: [
      {
        clause: String,
        riskLevel: {
          type: String,
          enum: ['Low', 'Medium', 'High'],
        },
        riskScore: Number,
        explanation: String,
        affectedParty: String,
        mitigation: String,
      },
    ],
    missingClauses: [
      {
        clauseId: String,
        clauseName: String,
        importance: {
          type: String,
          enum: ['low', 'medium', 'high'],
        },
        description: String,
        riskIfMissing: String,
        recommendation: String,
      },
    ],
    riskyLanguage: [
      {
        riskId: String,
        riskType: String,
        detectedText: String,
        context: String,
        riskLevel: {
          type: String,
          enum: ['Low', 'Medium', 'High'],
        },
        explanation: String,
        location: {
          start: Number,
          end: Number,
        },
      },
    ],
    financialRisks: {
      deposits: [String],
      fees: [String],
      penalties: [String],
      highValueItems: [String],
      totalFinancialExposure: String,
      riskLevel: {
        type: String,
        enum: ['Low', 'Medium', 'High'],
      },
    },
    recommendations: [
      {
        priority: {
          type: String,
          enum: ['Low', 'Medium', 'High', 'Critical'],
        },
        type: {
          type: String,
        },
        action: String,
        rationale: String,
      },
    ],
    complianceScore: {
      type: Number,
      min: 0,
      max: 100,
    },
    analysisStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending',
    },
    analyzedAt: Date,
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Index for fast lookups
riskAnalysisSchema.index({ documentId: 1 });
riskAnalysisSchema.index({ userId: 1 });
riskAnalysisSchema.index({ createdAt: -1 });

module.exports = mongoose.model('RiskAnalysis', riskAnalysisSchema);
