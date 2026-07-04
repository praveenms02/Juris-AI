const express = require('express');
const { requireAuth } = require('../middleware/auth');
const {
  analyzeRisk,
  getRisk,
  getUserRisks,
  deleteRisk,
} = require('../controllers/riskController');

const router = express.Router();

// All risk routes require authentication
router.use(requireAuth);

/**
 * POST /api/risk/analyze/:documentId
 * Analyze document for risks
 */
router.post('/analyze/:documentId', analyzeRisk);

/**
 * GET /api/risk/:documentId
 * Get risk analysis for specific document
 */
router.get('/:documentId', getRisk);

/**
 * GET /api/risk
 * Get all risk analyses for current user
 */
router.get('/', getUserRisks);

/**
 * DELETE /api/risk/:documentId
 * Delete risk analysis for document
 */
router.delete('/:documentId', deleteRisk);

module.exports = router;
