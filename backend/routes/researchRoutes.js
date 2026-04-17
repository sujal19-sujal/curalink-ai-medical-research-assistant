const express = require('express');
const router = express.Router();

const {
  handleResearchQuery,
  getConversationHistory,
  clearConversation,
  healthCheck,
} = require('../controllers/researchController');

// POST /api/research/query — main pipeline endpoint
router.post('/query', handleResearchQuery);

// GET /api/research/history/:sessionId — get conversation history
router.get('/history/:sessionId', getConversationHistory);

// DELETE /api/research/history/:sessionId — clear conversation
router.delete('/history/:sessionId', clearConversation);

// GET /api/research/health — check Ollama + service status
router.get('/health', healthCheck);

module.exports = router;
