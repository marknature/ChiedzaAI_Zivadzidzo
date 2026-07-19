const express = require('express');
const { getIndustry4ModelStatus, predictIndustry4Cohort } = require('../services/industry4ModelService');

const router = express.Router();

router.get('/industry4/status', (_req, res) => {
  try {
    res.json({ success: true, model: getIndustry4ModelStatus() });
  } catch (error) {
    res.status(error.code === 'MODEL_UNAVAILABLE' ? 503 : 500).json({ success: false, error: error.message });
  }
});

// Aggregate cohort values only. The endpoint intentionally persists nothing and validates
// every supplied feature. Keeping it unauthenticated supports the no-Supabase hackathon demo;
// production should put this route behind the existing school-leader auth policy.
router.post('/industry4/predict', (req, res) => {
  try {
    res.json({ success: true, insight: predictIndustry4Cohort(req.body?.cohortFeatures) });
  } catch (error) {
    const status = error.code === 'VALIDATION' ? 400 : error.code === 'MODEL_UNAVAILABLE' ? 503 : 500;
    res.status(status).json({ success: false, error: error.message });
  }
});

module.exports = router;
