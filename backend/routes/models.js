const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { PREDICTION_WRITE_ROLES } = require('../config');
const { getIndustry4ModelStatus, predictIndustry4Cohort } = require('../services/industry4ModelService');

const router = express.Router();

router.get('/industry4/status', (_req, res) => {
  try {
    res.json({ success: true, model: getIndustry4ModelStatus() });
  } catch (error) {
    res.status(error.code === 'MODEL_UNAVAILABLE' ? 503 : 500).json({ success: false, error: error.message });
  }
});

// Aggregate cohort values only. This deliberately requires an authorised school leader
// and never receives learner identifiers or persists an individual prediction.
router.post('/industry4/predict', requireAuth, requireRole(...PREDICTION_WRITE_ROLES), (req, res) => {
  try {
    res.json({ success: true, insight: predictIndustry4Cohort(req.body?.cohortFeatures) });
  } catch (error) {
    const status = error.code === 'VALIDATION' ? 400 : error.code === 'MODEL_UNAVAILABLE' ? 503 : 500;
    res.status(status).json({ success: false, error: error.message });
  }
});

module.exports = router;
