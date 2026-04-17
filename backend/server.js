const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const researchRoutes = require('./routes/researchRoutes');

const app = express();

app.use(cors());
app.use(express.json());

// Connect to MongoDB (optional — app works without it)
mongoose.connect(process.env.MONGO_URI, {
  serverSelectionTimeoutMS: 3000,
  connectTimeoutMS: 3000,
})
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => {
    console.warn('⚠️  MongoDB unavailable — running without context memory:', err.message);
  });

// Expose DB status globally
mongoose.connection.on('connected', () => { global.mongoAvailable = true; });
mongoose.connection.on('error', () => { global.mongoAvailable = false; });
mongoose.connection.on('disconnected', () => { global.mongoAvailable = false; });

// Routes
app.use('/api/research', researchRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Curalink API is running' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Curalink backend running on port ${PORT}`);
});
