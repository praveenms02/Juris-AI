const {
  analyzeDocumentRisks,
  getRiskAnalysis,
  getUserRiskAnalyses,
  deleteRiskAnalysis,
} = require('../services/riskService');

/**
 * POST /api/risk/analyze/:documentId
 * Analyze a document for risks
 */
async function analyzeRisk(req, res) {
  try {
    const { documentId } = req.params;
    const userId = req.user.id; // From auth middleware

    const riskAnalysis = await analyzeDocumentRisks(userId, documentId);

    res.json({
      ok: true,
      data: riskAnalysis,
    });
  } catch (error) {
    console.error('Analyze risk error:', error.message);
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
}

/**
 * GET /api/risk/:documentId
 * Get risk analysis for a document
 */
async function getRisk(req, res) {
  try {
    const { documentId } = req.params;

    const riskAnalysis = await getRiskAnalysis(documentId);

    res.json({
      ok: true,
      data: riskAnalysis,
    });
  } catch (error) {
    console.error('Get risk error:', error.message);
    res.status(404).json({
      ok: false,
      error: error.message,
    });
  }
}

/**
 * GET /api/risk
 * Get all risk analyses for current user
 */
async function getUserRisks(req, res) {
  try {
    const userId = req.user.id; // From auth middleware

    const riskAnalyses = await getUserRiskAnalyses(userId);

    res.json({
      ok: true,
      data: riskAnalyses,
    });
  } catch (error) {
    console.error('Get user risks error:', error.message);
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
}

/**
 * DELETE /api/risk/:documentId
 * Delete risk analysis for a document
 */
async function deleteRisk(req, res) {
  try {
    const { documentId } = req.params;

    await deleteRiskAnalysis(documentId);

    res.json({
      ok: true,
      message: 'Risk analysis deleted',
    });
  } catch (error) {
    console.error('Delete risk error:', error.message);
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
}

module.exports = {
  analyzeRisk,
  getRisk,
  getUserRisks,
  deleteRisk,
};
