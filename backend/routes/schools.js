const express = require('express');
const multer = require('multer');
const { requireAuth, requireRole } = require('../middleware/auth');
const supabaseService = require('../services/supabaseService');
const { parseAndValidateRoster } = require('../services/importService');
const { PREDICTION_WRITE_ROLES } = require('../config');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
router.use(requireAuth);

router.get('/:id/structure', async (req, res) => {
  if (req.params.id !== req.profile.institution_id) return res.status(403).json({ success: false, error: 'You cannot access another institution.' });
  try {
    const client = supabaseService.clientForToken(req.authToken);
    const structure = await supabaseService.getSchoolStructure(client, req.profile.institution_id);
    res.json({ success: true, structure });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.post('/:id/import', requireRole(...PREDICTION_WRITE_ROLES), upload.single('file'), async (req, res) => {
  if (req.params.id !== req.profile.institution_id) return res.status(403).json({ success: false, error: 'You cannot import into another institution.' });
  if (!req.file) return res.status(400).json({ success: false, error: 'Attach a roster file in the file field.' });
  try {
    const report = parseAndValidateRoster(req.file.buffer, req.file.originalname);
    const client = supabaseService.clientForToken(req.authToken);
    const imported = await supabaseService.importRosterRows(client, req.profile.institution_id, report.valid.map((item) => item.value));
    res.status(201).json({ success: true, imported: imported.length, rejected: report.errors.length, errors: report.errors.map(({ row, errors }) => ({ row, errors })), acceptedColumns: report.acceptedColumns });
  } catch (error) { res.status(400).json({ success: false, error: error.message }); }
});

module.exports = router;
