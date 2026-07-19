const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const supabaseService = require('../services/supabaseService');
const predictionService = require('../services/predictionService');
const { TASK_TYPES, PREDICTION_WRITE_ROLES } = require('../config');
const { userRequestLimiter, userPredictionLimiter } = require('../middleware/security');

const router = express.Router();
router.use(requireAuth);
router.use(userRequestLimiter);

function handlePredictionError(res, error, taskLabel) {
  if (error.code === 'OPENAI_NOT_CONFIGURED') {
    return res.status(503).json({ success: false, error: 'OPENAI_API_KEY is not configured on the backend.' });
  }
  if (error.code === 'VALIDATION') {
    return res.status(400).json({ success: false, error: error.message });
  }
  if (error.code === 'NOT_FOUND') {
    return res.status(404).json({ success: false, error: error.message });
  }
  console.error(`${taskLabel} prediction failed:`, error.message);
  return res.status(502).json({ success: false, error: 'The prediction could not be completed. Please retry.' });
}

router.post('/teacher-roles', requireRole(...PREDICTION_WRITE_ROLES), userPredictionLimiter, async (req, res) => {
  try {
    const client = supabaseService.clientForToken(req.authToken);
    const prediction = await predictionService.predictTeacherRoles({
      client,
      profile: req.profile,
      teacherId: req.body?.teacherId,
    });
    res.status(201).json({ success: true, prediction });
  } catch (error) {
    handlePredictionError(res, error, 'Teacher Roles');
  }
});

router.get('/teacher-roles', async (req, res) => {
  try {
    const client = supabaseService.clientForToken(req.authToken);
    const predictions = await supabaseService.listPredictions(client, req.profile.institution_id, TASK_TYPES.TEACHER_ROLES, req.query.teacherId);
    res.json({ success: true, predictions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/learning-outcomes', requireRole(...PREDICTION_WRITE_ROLES), userPredictionLimiter, async (req, res) => {
  try {
    const client = supabaseService.clientForToken(req.authToken);
    const prediction = await predictionService.predictLearningOutcomes({
      client,
      profile: req.profile,
      ...(req.body || {}),
      rawBody: req.body,
    });
    res.status(201).json({ success: true, prediction });
  } catch (error) {
    handlePredictionError(res, error, 'Learning Outcomes');
  }
});

router.get('/learning-outcomes', async (req, res) => {
  try {
    const client = supabaseService.clientForToken(req.authToken);
    const predictions = await supabaseService.listPredictions(client, req.profile.institution_id, TASK_TYPES.LEARNING_OUTCOMES);
    res.json({ success: true, predictions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// The authenticated frontend uses this canonical curriculum_skills head. It persists
// the same structured contract and model/prompt version as the other two heads.
router.post('/curriculum-skills', requireRole(...PREDICTION_WRITE_ROLES), userPredictionLimiter, async (req, res) => {
  try {
    const client = supabaseService.clientForToken(req.authToken);
    const prediction = await predictionService.predictCurriculumSkills({
      client,
      profile: req.profile,
      ...(req.body || {}),
    });
    res.status(201).json({ success: true, prediction });
  } catch (error) {
    handlePredictionError(res, error, 'Curriculum Skills');
  }
});

router.get('/curriculum-skills', async (req, res) => {
  try {
    const client = supabaseService.clientForToken(req.authToken);
    const predictions = await supabaseService.listPredictions(client, req.profile.institution_id, TASK_TYPES.CURRICULUM_SKILLS);
    res.json({ success: true, predictions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
