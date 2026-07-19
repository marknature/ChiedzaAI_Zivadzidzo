const express = require('express');
const { requireAuth } = require('../middleware/auth');
const supabaseService = require('../services/supabaseService');
const { AI_TOOL_USAGE_FREQUENCY_NUMERIC } = require('../config');
const { userRequestLimiter } = require('../middleware/security');

const router = express.Router();
router.use(requireAuth);
router.use(userRequestLimiter);

router.get('/', async (req, res) => {
  try {
    const client = supabaseService.clientForToken(req.authToken);
    const teachers = await supabaseService.listTeachers(client, req.profile.institution_id);
    res.json({ success: true, teachers });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', async (req, res) => {
  const { fullName, subjectId, yearsExperience, aiToolUsageFrequency, digitalSkillsScore, trainingHours } = req.body || {};
  if (!fullName || typeof fullName !== 'string') {
    return res.status(400).json({ success: false, error: 'fullName is required.' });
  }
  if (aiToolUsageFrequency && !(aiToolUsageFrequency in AI_TOOL_USAGE_FREQUENCY_NUMERIC)) {
    return res.status(400).json({ success: false, error: 'aiToolUsageFrequency must be one of never/rarely/sometimes/often/daily.' });
  }

  try {
    const client = supabaseService.clientForToken(req.authToken);
    const teacher = await supabaseService.insertTeacher(client, {
      institution_id: req.profile.institution_id,
      full_name: fullName,
      subject_id: subjectId || null,
      years_experience: yearsExperience ?? null,
      ai_tool_usage_frequency: aiToolUsageFrequency || null,
      digital_skills_score: digitalSkillsScore ?? null,
      training_hours: trainingHours ?? null,
      last_assessed_at: new Date().toISOString(),
    });
    res.status(201).json({ success: true, teacher });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch('/:id', async (req, res) => {
  const patch = {};
  const { fullName, subjectId, yearsExperience, aiToolUsageFrequency, digitalSkillsScore, trainingHours } = req.body || {};
  if (fullName !== undefined) patch.full_name = fullName;
  if (subjectId !== undefined) patch.subject_id = subjectId;
  if (yearsExperience !== undefined) patch.years_experience = yearsExperience;
  if (aiToolUsageFrequency !== undefined) {
    if (!(aiToolUsageFrequency in AI_TOOL_USAGE_FREQUENCY_NUMERIC)) {
      return res.status(400).json({ success: false, error: 'aiToolUsageFrequency must be one of never/rarely/sometimes/often/daily.' });
    }
    patch.ai_tool_usage_frequency = aiToolUsageFrequency;
  }
  if (digitalSkillsScore !== undefined) patch.digital_skills_score = digitalSkillsScore;
  if (trainingHours !== undefined) patch.training_hours = trainingHours;

  if (Object.keys(patch).length === 0) {
    return res.status(400).json({ success: false, error: 'No updatable fields provided.' });
  }

  try {
    const client = supabaseService.clientForToken(req.authToken);
    const teacher = await supabaseService.updateTeacher(client, req.params.id, patch);
    res.json({ success: true, teacher });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
