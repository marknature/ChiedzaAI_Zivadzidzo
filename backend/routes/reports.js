const express = require('express');
const { requireAuth } = require('../middleware/auth');
const supabaseService = require('../services/supabaseService');
const reportService = require('../services/reportService');
const router = express.Router();
router.use(requireAuth);

router.post('/prediction/:id', async (req, res) => { try { const client = supabaseService.clientForToken(req.authToken); const predictions = await supabaseService.listPredictions(client, req.profile.institution_id); const prediction = predictions.find((item) => item.id === req.params.id); if (!prediction) return res.status(404).json({ success: false, error: 'Prediction not found.' }); const report = await reportService.generatePredictionReport({ prediction, institutionId: req.profile.institution_id, createdBy: req.profile.id, format: req.body?.format, client }); res.status(201).json({ success: true, ...report }); } catch (error) { res.status(502).json({ success: false, error: error.message }); } });
router.post('/chat/:sessionId', async (req, res) => { try { const client = supabaseService.clientForToken(req.authToken); const messages = await supabaseService.listChatMessages(client, req.params.sessionId); const report = await reportService.generateChatReport({ messages, institutionId: req.profile.institution_id, createdBy: req.profile.id, format: req.body?.format, client }); res.status(201).json({ success: true, ...report }); } catch (error) { res.status(502).json({ success: false, error: error.message }); } });
module.exports = router;
