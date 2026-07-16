const express = require('express');
const cors = require('cors');
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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});