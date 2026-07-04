const axios = require('axios');
const RiskAnalysis = require('../models/RiskAnalysis');
const Document = require('../models/Document');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000';

function normalizeRiskLevel(level) {
  if (!level) return 'Medium';
  const normalized = String(level).trim().toLowerCase();
  if (normalized === 'low') return 'Low';
  if (normalized === 'high') return 'High';
  return 'Medium';
}

function mapRiskBreakdown(breakdown = {}) {
  return {
    clauseRisk: breakdown.clause_risk ?? breakdown.clauseRisk ?? 0,
    missingClauses: breakdown.missing_clauses ?? breakdown.missingClauses ?? 0,
    riskyLanguage: breakdown.risky_language ?? breakdown.riskyLanguage ?? 0,
    financialRisk: breakdown.financial_risk ?? breakdown.financialRisk ?? 0,
  };
}

function mapMissingClauses(missingClauses = []) {
  return missingClauses.map((clause) => ({
    clauseId: clause.clause_id ?? clause.clauseId ?? '',
    clauseName: clause.clause_name ?? clause.clauseName ?? '',
    importance: clause.importance ?? 'medium',
    description: clause.description ?? '',
    riskIfMissing: clause.risk_if_missing ?? clause.riskIfMissing ?? '',
    recommendation: clause.recommendation ?? '',
  }));
}

function mapRiskyLanguage(riskyLanguage = []) {
  return riskyLanguage.map((item) => {
    const riskId = item.risk_id ?? item.riskId ?? '';
    const riskTypeFromId = riskId
      ? riskId.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      : 'Risk';
    const mapped = {
      riskId,
      riskType: item.risk_type ?? item.riskType ?? riskTypeFromId,
      detectedText: item.detected_text ?? item.detectedText ?? '',
      context: item.context ?? '',
      riskLevel: normalizeRiskLevel(item.risk_level ?? item.riskLevel),
      explanation: item.explanation ?? '',
      location: {
        start: item.location?.start ?? 0,
        end: item.location?.end ?? 0,
      },
    };
    mapped.detectedText = inferDetectedText(mapped);
    return mapped;
  });
}

function mapFinancialRisks(financialRisks = {}) {
  return {
    deposits: financialRisks.deposits ?? [],
    fees: financialRisks.fees ?? [],
    penalties: financialRisks.penalties ?? [],
    highValueItems: financialRisks.high_value_items ?? financialRisks.highValueItems ?? [],
    totalFinancialExposure:
      financialRisks.total_financial_exposure ?? financialRisks.totalFinancialExposure ?? null,
    riskLevel: normalizeRiskLevel(financialRisks.risk_level ?? financialRisks.riskLevel ?? 'Low'),
  };
}

function mapClauseRisks(clauseRisks = []) {
  return clauseRisks.map((clause) => ({
    clause: clause.clause ?? '',
    riskLevel: normalizeRiskLevel(clause.risk_level ?? clause.riskLevel),
    riskScore: clause.risk_score ?? clause.riskScore ?? 0,
    explanation: clause.explanation ?? '',
    affectedParty: clause.affected_party ?? clause.affectedParty ?? '',
    mitigation: clause.mitigation ?? '',
  }));
}

function mapRecommendations(recommendations = []) {
  return recommendations.map((rec) => ({
    priority:
      rec.priority === 'Critical'
        ? 'Critical'
        : ['Low', 'Medium', 'High'].includes(rec.priority)
          ? rec.priority
          : normalizeRiskLevel(rec.priority),
    type: rec.type ?? '',
    action: rec.action ?? '',
    rationale: rec.rationale ?? '',
  }));
}

function inferDetectedText(item) {
  const existing = item.detectedText ?? item.detected_text ?? '';
  if (existing) return existing;

  const context = item.context ?? '';
  const patterns = [
    /non[- ]?refundable/i,
    /unlimited liability/i,
    /unlimited damages/i,
    /automatic(?:ally)? renew(?:al)?/i,
    /(?:early )?termination fee/i,
    /liquidated damages/i,
    /indemnif(?:y|ication)[^.]{0,60}/i,
    /penalty[^.]{0,40}/i,
    /(?:₹|rs\.?\s*|inr\s*)[0-9,]+(?:\.\d{2})?/i,
  ];

  for (const pattern of patterns) {
    const match = context.match(pattern);
    if (match) return match[0].trim();
  }

  return context.trim().slice(0, 120) || 'Risky language detected';
}

function scoreClauses(clauseRisks = []) {
  if (!clauseRisks.length) return 0;
  const total = clauseRisks.reduce(
    (sum, clause) => sum + (clause.riskScore ?? clause.risk_score ?? 0.5),
    0
  );
  return total / clauseRisks.length;
}

function scoreMissingClauses(missingClauses = []) {
  if (!missingClauses.length) return 0;
  let score = 0;
  for (const clause of missingClauses) {
    if (clause.importance === 'high') score += 0.1;
    else if (clause.importance === 'medium') score += 0.05;
  }
  return Math.min(score, 1);
}

function scoreRiskyLanguage(riskyLanguage = []) {
  if (!riskyLanguage.length) return 0;
  let score = 0;
  for (const item of riskyLanguage) {
    const level = String(item.riskLevel ?? item.risk_level ?? '').toLowerCase();
    if (level === 'high') score += 0.08;
    else if (level === 'medium') score += 0.03;
  }
  return Math.min(score, 1);
}

function scoreFinancialRisks(financialRisks = {}) {
  const level = String(financialRisks.riskLevel ?? financialRisks.risk_level ?? 'Low');
  if (level === 'High') return 0.8;
  if (level === 'Medium') return 0.4;
  return 0.1;
}

function computeRiskBreakdown({
  clauseRisks = [],
  missingClauses = [],
  riskyLanguage = [],
  financialRisks = {},
}) {
  return {
    clauseRisk: scoreClauses(clauseRisks),
    missingClauses: scoreMissingClauses(missingClauses),
    riskyLanguage: scoreRiskyLanguage(riskyLanguage),
    financialRisk: scoreFinancialRisks(financialRisks),
  };
}

function computeOverallRiskScore(breakdown) {
  const weights = {
    clauseRisk: 0.35,
    missingClauses: 0.3,
    riskyLanguage: 0.2,
    financialRisk: 0.15,
  };

  const score =
    (breakdown.clauseRisk ?? 0) * weights.clauseRisk +
    (breakdown.missingClauses ?? 0) * weights.missingClauses +
    (breakdown.riskyLanguage ?? 0) * weights.riskyLanguage +
    (breakdown.financialRisk ?? 0) * weights.financialRisk;

  return Math.round(score * 100);
}

function isBreakdownEmpty(breakdown = {}) {
  return ![
    breakdown.clauseRisk ?? breakdown.clause_risk,
    breakdown.missingClauses ?? breakdown.missing_clauses,
    breakdown.riskyLanguage ?? breakdown.risky_language,
    breakdown.financialRisk ?? breakdown.financial_risk,
  ].some((value) => Number(value) > 0);
}

function repairRiskAnalysisRecord(record) {
  const plain = record?.toObject ? record.toObject() : { ...record };

  const clauseRisks = mapClauseRisks(plain.clauseRisks ?? plain.clause_risks ?? []);
  const missingClauses = mapMissingClauses(plain.missingClauses ?? plain.missing_clauses ?? []);
  const riskyLanguage = mapRiskyLanguage(plain.riskyLanguage ?? plain.risky_language ?? []).map(
    (item) => ({
      ...item,
      detectedText: inferDetectedText(item),
      riskType:
        item.riskType ||
        (item.riskId ? item.riskId.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Risk'),
    })
  );
  const financialRisks = mapFinancialRisks(plain.financialRisks ?? plain.financial_risks ?? {});

  let riskBreakdown = mapRiskBreakdown(plain.riskBreakdown ?? plain.risk_breakdown ?? {});
  if (
    isBreakdownEmpty(riskBreakdown) &&
    (clauseRisks.length || missingClauses.length || riskyLanguage.length)
  ) {
    riskBreakdown = computeRiskBreakdown({
      clauseRisks,
      missingClauses,
      riskyLanguage,
      financialRisks,
    });
  }

  const overallRiskScore =
    plain.overallRiskScore ??
    plain.overall_risk_score ??
    computeOverallRiskScore(riskBreakdown);

  return {
    ...plain,
    overallRiskScore,
    riskLevel: plain.riskLevel ?? getRiskLevel(overallRiskScore),
    riskBreakdown,
    clauseRisks,
    missingClauses,
    riskyLanguage,
    financialRisks,
    recommendations: mapRecommendations(plain.recommendations ?? []),
    complianceScore:
      plain.complianceScore ??
      calculateComplianceScore(missingClauses, clauseRisks),
  };
}

function needsRiskAnalysisRepair(record) {
  const plain = record?.toObject ? record.toObject() : record;
  const breakdown = plain.riskBreakdown ?? plain.risk_breakdown ?? {};
  const hasNestedData =
    (plain.missingClauses ?? plain.missing_clauses ?? []).length > 0 ||
    (plain.riskyLanguage ?? plain.risky_language ?? []).length > 0 ||
    (plain.clauseRisks ?? plain.clause_risks ?? []).length > 0;

  if (hasNestedData && isBreakdownEmpty(breakdown)) return true;

  const riskyLanguage = plain.riskyLanguage ?? plain.risky_language ?? [];
  if (
    riskyLanguage.some(
      (item) =>
        !(item.detectedText ?? item.detected_text) &&
        (item.context || item.explanation)
    )
  ) {
    return true;
  }

  const missingClauses = plain.missingClauses ?? plain.missing_clauses ?? [];
  if (missingClauses.some((item) => !(item.clauseName ?? item.clause_name) && item.importance)) {
    return true;
  }

  return false;
}

function mapAiResponseToSchema(riskData) {
  const missingClauses = mapMissingClauses(riskData.missing_clauses ?? riskData.missingClauses);
  const clauseRisks = mapClauseRisks(riskData.clause_risks ?? riskData.clauseRisks);

  return {
    overallRiskScore: riskData.overall_risk_score ?? riskData.overallRiskScore ?? 0,
    riskLevel: getRiskLevel(riskData.overall_risk_score ?? riskData.overallRiskScore ?? 0),
    riskBreakdown: mapRiskBreakdown(riskData.risk_breakdown ?? riskData.riskBreakdown),
    clauseRisks,
    missingClauses,
    riskyLanguage: mapRiskyLanguage(riskData.risky_language ?? riskData.riskyLanguage),
    financialRisks: mapFinancialRisks(riskData.financial_risks ?? riskData.financialRisks),
    recommendations: mapRecommendations(riskData.recommendations ?? []),
    complianceScore: calculateComplianceScore(missingClauses, clauseRisks),
    analysisStatus: 'completed',
    analyzedAt: new Date(),
  };
}

/**
 * Analyze document for risks
 */
async function analyzeDocumentRisks(userId, documentId) {
  try {
    // Fetch document from MongoDB
    const document = await Document.findById(documentId);
    if (!document) {
      throw new Error('Document not found');
    }

    if (!document.extractedText) {
      throw new Error('Document text not extracted yet');
    }

    // Use AI-detected clauses when available, otherwise extract from text
    const clauses = getClausesForAnalysis(document);

    // Call AI service risk analysis endpoint
    const response = await axios.post(`${AI_SERVICE_URL}/analyze-risk`, {
      document_id: documentId,
      extracted_text: document.extractedText,
      clauses: clauses,
    });

    const mappedRiskData = mapAiResponseToSchema(response.data);

    // Create or update risk analysis record
    const riskAnalysis = await RiskAnalysis.findOneAndUpdate(
      { documentId, userId },
      {
        userId,
        documentId,
        ...mappedRiskData,
      },
      { upsert: true, new: true }
    );

    return repairRiskAnalysisRecord(riskAnalysis);
  } catch (error) {
    console.error('Risk analysis error:', error.message);
    throw error;
  }
}

/**
 * Get risk analysis for a document
 */
async function getRiskAnalysis(documentId) {
  try {
    const riskAnalysis = await RiskAnalysis.findOne({
      documentId,
    }).populate('documentId', 'filename');

    if (!riskAnalysis) {
      throw new Error('Risk analysis not found');
    }

    if (needsRiskAnalysisRepair(riskAnalysis)) {
      const repaired = repairRiskAnalysisRecord(riskAnalysis);
      await RiskAnalysis.findByIdAndUpdate(riskAnalysis._id, {
        overallRiskScore: repaired.overallRiskScore,
        riskLevel: repaired.riskLevel,
        riskBreakdown: repaired.riskBreakdown,
        clauseRisks: repaired.clauseRisks,
        missingClauses: repaired.missingClauses,
        riskyLanguage: repaired.riskyLanguage,
        financialRisks: repaired.financialRisks,
        recommendations: repaired.recommendations,
        complianceScore: repaired.complianceScore,
      });
      return repaired;
    }

    return repairRiskAnalysisRecord(riskAnalysis);
  } catch (error) {
    console.error('Get risk analysis error:', error.message);
    throw error;
  }
}

/**
 * Get all risk analyses for a user
 */
async function getUserRiskAnalyses(userId) {
  try {
    const riskAnalyses = await RiskAnalysis.find({
      userId,
    })
      .populate('documentId', 'filename')
      .sort({ createdAt: -1 });

    return riskAnalyses.map((record) => repairRiskAnalysisRecord(record));
  } catch (error) {
    console.error('Get user risk analyses error:', error.message);
    throw error;
  }
}

/**
 * Delete risk analysis
 */
async function deleteRiskAnalysis(documentId) {
  try {
    const result = await RiskAnalysis.deleteOne({
      documentId,
    });

    return result;
  } catch (error) {
    console.error('Delete risk analysis error:', error.message);
    throw error;
  }
}

/**
 * Prefer structured clauses from document analysis, with text extraction as fallback.
 */
function getClausesForAnalysis(document) {
  if (Array.isArray(document.clauses) && document.clauses.length > 0) {
    const structuredClauses = document.clauses
      .map((clause) => {
        if (typeof clause === 'string') return clause.trim();
        return (clause.text || clause.clause || clause.title || '').trim();
      })
      .filter((clause) => clause.length > 20);

    if (structuredClauses.length > 0) {
      return [...new Set(structuredClauses)].slice(0, 20);
    }
  }

  return extractClauses(document.extractedText);
}

/**
 * Extract clauses from document text using simple pattern matching
 */
function extractClauses(text) {
  const clauses = [];
  const lines = text.split('\n');

  // Look for common clause patterns
  const clausePatterns = [
    /^\s*\d+\.\s+(.+?)(?=\n|$)/gm,
    /^(.*?clause.*?)(?=\n|$)/gim,
    /^(.*?)(?=\n\d+\.|$)/gm,
  ];

  for (const pattern of clausePatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      if (match[1] && match[1].length > 20 && match[1].length < 1000) {
        clauses.push(match[1].trim());
      }
    }
  }

  // Remove duplicates
  return [...new Set(clauses)].slice(0, 20); // Limit to 20 clauses
}

/**
 * Determine risk level from score
 */
function getRiskLevel(score) {
  if (score <= 30) return 'Low';
  if (score <= 60) return 'Medium';
  return 'High';
}

/**
 * Calculate compliance score
 */
function calculateComplianceScore(missingClauses, clauseRisks) {
  let score = 100;

  // Deduct for missing clauses
  for (const missing of missingClauses) {
    if (missing.importance === 'high') {
      score -= 15;
    } else if (missing.importance === 'medium') {
      score -= 10;
    } else {
      score -= 5;
    }
  }

  // Deduct for high-risk clauses
  for (const clause of clauseRisks) {
    const riskLevel = clause.riskLevel ?? clause.risk_level;
    if (riskLevel === 'High') {
      score -= 10;
    } else if (riskLevel === 'Medium') {
      score -= 5;
    }
  }

  return Math.max(0, Math.min(100, score));
}

module.exports = {
  analyzeDocumentRisks,
  getRiskAnalysis,
  getUserRiskAnalyses,
  deleteRiskAnalysis,
};
