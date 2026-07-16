const express = require('express');
const cors = require('cors');
const supabase = require('./db'); // Import the Supabase client connection
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Base Route
app.get('/', (req, res) => {
  res.json({ message: "ZivaDzidzo API is live!" });
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