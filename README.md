# 🧬 Curalink — AI Medical Research Assistant

A **production-ready MERN stack** application that performs deep medical research retrieval, intelligent ranking, and AI-powered reasoning using a **local LLM (Ollama)**.

---

## 🏗 Architecture

```
curalink/
├── backend/                     # Node.js + Express API
│   ├── server.js                # Entry point
│   ├── .env                     # Environment config
│   ├── controllers/
│   │   └── researchController.js  # Full 9-step pipeline
│   ├── services/
│   │   ├── queryBuilder.js      # Semantic intent parsing & synonym expansion
│   │   ├── pubmedService.js     # PubMed esearch + efetch
│   │   ├── openalexService.js   # OpenAlex works API
│   │   ├── clinicalTrialService.js  # ClinicalTrials.gov v2
│   │   ├── rankingEngine.js     # Semantic Similarity (transformers) + relevance + recency scoring
│   │   ├── clusteringEngine.js  # Evidence strength calculation & theme grouping
│   │   └── llmService.js        # Doctor-level Ollama research reasoning
│   ├── models/
│   │   └── Conversation.js      # MongoDB conversation schema
│   └── routes/
│       └── researchRoutes.js    # Express routes
│
└── frontend/                    # React app
    └── src/
        ├── App.js               # Main app + session management
        ├── api/
        │   └── researchApi.js   # Backend API client
        └── components/
            ├── MessageList.jsx  # Chat message display
            ├── InputForm.jsx    # Smart query form
            ├── PublicationCard.jsx
            ├── ClinicalTrialCard.jsx
            └── MarkdownRenderer.jsx
```

---

## 🚀 Quick Start

### Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | ≥ 18 | Backend + Frontend |
| MongoDB | ≥ 6 | Context storage |
| Ollama | Latest | Local LLM |

### 1. Install Ollama + Pull Model

```bash
# Install from https://ollama.ai
ollama pull llama3
# or: ollama pull mistral
```

### 2. Start MongoDB

```bash
mongod
# or use MongoDB Atlas: update MONGO_URI in backend/.env
```

### 3. Start Backend

```bash
cd backend
npm install
npm run dev
# Runs on http://localhost:5000
```

### 4. Start Frontend

```bash
cd frontend
npm install
npm start
# Opens http://localhost:3000
```

---

## 🔁 Pipeline Flow

```
User Input (disease + query + location)
         ↓
   Query Expansion (Semantic Synonyms & Intent Parsing)
         ↓
   ┌─────────────────────────────────┐
   │  Parallel Deep Retrieval (50+)  │
   │  ├── PubMed (esearch + efetch)  │
   │  ├── OpenAlex (works API)       │
   │  └── ClinicalTrials.gov v2      │
   └─────────────────────────────────┘
         ↓
   Normalization → Unified format
         ↓
   Hybrid Ranking Engine (Keyword + Recency + Semantic Similarity)
         ↓
   Top 8 publications + 6 trials selected
         ↓
   Clustering Engine (Grouping themes & Evidence Strength Scoring)
         ↓
   Ollama LLM Reasoning (Doctor-Level structured strict prompt)
         ↓
   Structured Response + Confidence Score + Citations
         ↓
   MongoDB: Save context for follow-ups
```

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/research/query` | Main pipeline |
| `GET`  | `/api/research/history/:sessionId` | Load conversation |
| `DELETE` | `/api/research/history/:sessionId` | Clear session |
| `GET`  | `/api/research/health` | Ollama status |
| `GET`  | `/api/health` | Server status |

### Request Body (POST /api/research/query)

```json
{
  "sessionId": "uuid-v4",
  "disease": "Lung Cancer",
  "query": "Vitamin D therapy effectiveness",
  "location": "USA"
}
```

---

## 🌍 Deployment

### Frontend → Vercel
```bash
cd frontend
npm run build
# Deploy build/ folder to Vercel
# Set REACT_APP_API_URL=https://your-backend.render.com/api
```

### Backend → Render / Railway
```
Build: npm install
Start: node server.js
Env vars: MONGO_URI, OLLAMA_BASE_URL, OLLAMA_MODEL
```

### MongoDB → Atlas
Update `MONGO_URI` in `backend/.env`:
```
MONGO_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/curalink
```

---

## ⚙️ Environment Variables

### Backend (`backend/.env`)

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/curalink
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3
```

### Frontend (`frontend/.env`)

```env
REACT_APP_API_URL=http://localhost:5000/api
```

---

## 🧠 LLM Details

- **Model**: llama3 or mistral (local via Ollama)
- **Temperature**: 0.2 (extremely low hallucination & high medical rigor)
- **Prompt**: Strict "Doctor-level" system prompt enforcing data-only responses, citation of provided clusters [e.g., 1.1], and practical neutral interpretation with a medical disclaimer.
- **Fail-Safe Dropout**: If the evidence cluster calculates out to "Weak" and no trials are returned, the system bypasses hallucination risks natively and returns "Insufficient high-quality research".
- **Fallback**: If Ollama is offline, a structured data markdown summary is shown visually without reasoning.

---

## 📊 Hybrid Ranking Algorithm

Publications are natively embedded into semantic vectors using `@xenova/transformers` (`all-MiniLM-L6-v2`) and evaluated on:
- **Semantic Similarity / Cosine Distance**: 25% weight.
- **Keyword Match Weights**: 35% weight.
- **Recency Penalty/Rewards**: 25% weight (≤1 yr: MAX, scaling down natively up to 10 years).
- **Source/Quality metrics**: 15% weight.

Clinical Trials additionally scored on:
- **Keyword match**: +10/+4 pts
- **RECRUITING status**: +15 pts
- **Phase 3/4**: +8 pts

## 🧩 Clustering & Evidence Strength Engine

After ranking, studies are batched into themes (`Treatment & Efficacy`, `Clinical Outcomes`, `Mechanisms`) dynamically based on heuristics. The engine verifies count limits and recency vs abstract scores to output an **Evidence Strength Level** `(Strong / Moderate / Weak)` which dynamically alters the AI's rigidity.

---

Built for hackathon-winning performance. 🏆
