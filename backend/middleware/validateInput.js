const MAX_QUERY_LENGTH = 2000;
const ALLOWED_MODES = new Set(["legal", "explain", "study", "quiz", "topics"]);

/**
 * Validate chat and intelligence request inputs.
 */
function validateIntelligenceInput(req, res, next) {
  const mode = req.body?.mode;
  if (mode && !ALLOWED_MODES.has(mode)) {
    return res.status(400).json({ message: "Invalid mode." });
  }

  const query = req.body?.query;
  if (query != null && String(query).length > MAX_QUERY_LENGTH) {
    return res.status(400).json({ message: `Query must be under ${MAX_QUERY_LENGTH} characters.` });
  }

  const docId = req.params?.documentId || req.body?.documentId;
  if (docId && !/^[a-f\d]{24}$/i.test(String(docId))) {
    return res.status(400).json({ message: "Invalid documentId." });
  }

  next();
}

module.exports = { validateIntelligenceInput, MAX_QUERY_LENGTH, ALLOWED_MODES };
