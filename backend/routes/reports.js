const express = require('express');
const { requireAuth } = require('../middleware/auth');
const supabaseService = require('../services/supabaseService');
const reportService = require('../services/reportService');
const { userRequestLimiter } = require('../middleware/security');
const router = express.Router();
router.use(requireAuth);
router.use(userRequestLimiter);

router.get('/', async (req, res) => { try { const client = supabaseService.clientForToken(req.authToken); const reports = await supabaseService.listReports(client, req.profile.institution_id); res.json({ success: true, reports }); } catch (error) { res.status(500).json({ success: false, error: error.message }); } });
router.get('/:id/download', async (req, res) => { try { const client = supabaseService.clientForToken(req.authToken); const reports = await supabaseService.listReports(client, req.profile.institution_id); const report = reports.find((item) => item.id === req.params.id); if (!report) return res.status(404).json({ success: false, error: 'Report not found.' }); const url = await reportService.signedUrlForReport(report.storage_path); res.json({ success: true, report, url }); } catch (error) { res.status(502).json({ success: false, error: error.message }); } });

router.post('/prediction/:id', async (req, res) => { try { const client = supabaseService.clientForToken(req.authToken); const predictions = await supabaseService.listPredictions(client, req.profile.institution_id); const prediction = predictions.find((item) => item.id === req.params.id); if (!prediction) return res.status(404).json({ success: false, error: 'Prediction not found.' }); const report = await reportService.generatePredictionReport({ prediction, institutionId: req.profile.institution_id, createdBy: req.profile.id, format: req.body?.format, client }); res.status(201).json({ success: true, ...report }); } catch (error) { res.status(502).json({ success: false, error: error.message }); } });
router.post('/chat/:sessionId', async (req, res) => { try { const client = supabaseService.clientForToken(req.authToken); const session = await supabaseService.getChatSession(client, req.params.sessionId, req.profile.institution_id); if (!session) return res.status(404).json({ success: false, error: 'Chat session not found.' }); const messages = await supabaseService.listChatMessages(client, session.id); const report = await reportService.generateChatReport({ messages, institutionId: req.profile.institution_id, createdBy: req.profile.id, format: req.body?.format, client }); res.status(201).json({ success: true, ...report }); } catch (error) { res.status(502).json({ success: false, error: error.message }); } });
module.exports = router;
