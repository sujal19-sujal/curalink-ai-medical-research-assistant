const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  disease: { type: String },
  query: { type: String },
  location: { type: String },
  sources: {
    publications: [mongoose.Schema.Types.Mixed],
    clinicalTrials: [mongoose.Schema.Types.Mixed],
  },
  timestamp: { type: Date, default: Date.now },
});

const conversationSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    disease: { type: String },
    location: { type: String },
    messages: [messageSchema],
    lastActiveAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

conversationSchema.pre('save', function (next) {
  this.lastActiveAt = new Date();
  next();
});

module.exports = mongoose.model('Conversation', conversationSchema);
