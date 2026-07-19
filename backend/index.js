const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const supabase = require('./db'); // Import the Supabase client connection
const { createAudit } = require('./auditService');
const authRoutes = require('./routes/auth');
const teachersRoutes = require('./routes/teachers');
const predictRoutes = require('./routes/predict');
const chatRoutes = require('./routes/chat');
const schoolsRoutes = require('./routes/schools');
const reportsRoutes = require('./routes/reports');
const notificationsRoutes = require('./routes/notifications');
const { ipLimiter } = require('./middleware/security');
require('dotenv').config({ quiet: true });

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(helmet());
app.use(express.json());
app.use(ipLimiter);

app.use('/auth', authRoutes);
app.use('/teachers', teachersRoutes);
app.use('/predict', predictRoutes);
app.use('/chat', chatRoutes);
app.use('/schools', schoolsRoutes);
app.use('/reports', reportsRoutes);
app.use('/notifications', notificationsRoutes);

// Base Route
app.get('/', (req, res) => {
  res.json({ message: "ZivaDzidzo API is live!", openaiConfigured: Boolean(process.env.OPENAI_API_KEY) });
});

app.post('/api/audit/analyze', async (req, res) => {
  const { title = 'Untitled curriculum', gradeLevel, syllabusText, alpha = 0.8 } = req.body || {};
  if (typeof syllabusText !== 'string' || syllabusText.trim().length < 12) {
    return res.status(400).json({ success: false, error: 'Please provide at least a short syllabus or course outline.' });
  }

  try {
    const audit = await createAudit({ title, gradeLevel, syllabusText: syllabusText.trim(), alpha });
    const record = {
      title,
      grade_level: gradeLevel || null,
      syllabus_text: syllabusText.trim(),
      readiness_index: audit.readinessIndex,
      future_skills_score: audit.futureSkillsScore,
      analysis: audit
    };

    // Persistence is optional for the demo. A missing table or unconfigured project must not break analysis.
    let saved = false;
    try {
      const { error } = await supabase.from('audits').insert([record]);
      saved = !error;
      if (error) console.warn('Audit was not persisted:', error.message);
    } catch (error) {
      console.warn('Audit persistence unavailable:', error.message);
    }

    res.status(200).json({ success: true, audit: { ...audit, title, gradeLevel }, saved });
  } catch (error) {
    console.error('Audit analysis failed:', error.message);
    res.status(502).json({ success: false, error: 'The curriculum analysis could not be completed. Please retry.' });
  }
});

// TEST ROUTE: Insert a mock industry trend into Supabase
app.post('/api/test-trend', async (req, res) => {
  try {
    const mockTrend = {
      skill_name: "Agentic Workflows (Codex/GPT-5.6)",
      category: "Software Development & DevOps",
      automation_risk: 0.15, // Low risk of replacement, high demand for orchestrators
      demand_growth_rate: 45.5 // 45.5% growth forecast
    };

    const { data, error } = await supabase
      .from('industry_trends')
      .insert([mockTrend])
      .select(); // Retrieves the newly inserted row back

    if (error) {
      throw error;
    }

    res.status(201).json({
      success: true,
      message: "Mock trend successfully inserted into Supabase!",
      insertedData: data
    });

  } catch (error) {
    console.error("❌ Database insertion failed:", error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Bind explicitly to all IPv4 interfaces
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://127.0.0.1:${PORT}`);
});
