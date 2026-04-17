import React, { useState, useRef, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import MessageList from './components/MessageList';
import InputForm from './components/InputForm';
import { sendResearchQuery, getConversationHistory, clearConversation, checkHealth } from './api/researchApi';

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({ sessions, currentSessionId, onSelectSession, onNewChat, ollamaStatus }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo-area">
          <div className="logo-icon">🧬</div>
          <div>
            <div className="logo-text">Curalink</div>
            <div className="logo-tagline">AI Medical Research Assistant</div>
          </div>
        </div>
        <button className="new-chat-btn" onClick={onNewChat} id="new-chat-btn">
          ✚ New Research Session
        </button>
      </div>

      <div className="sidebar-history">
        {sessions.length > 0 && (
          <>
            <div className="sidebar-section-label">Recent Sessions</div>
            {sessions.map((s) => (
              <div
                key={s.sessionId}
                className="history-item"
                onClick={() => onSelectSession(s.sessionId)}
                style={{
                  background: s.sessionId === currentSessionId ? 'var(--bg-card)' : '',
                  borderColor: s.sessionId === currentSessionId ? 'var(--border-bright)' : '',
                }}
              >
                <div className="history-item-disease">
                  {s.disease ? `🫁 ${s.disease}` : '🔬 Research Session'}
                </div>
                <div className="history-item-query">
                  {s.lastQuery || 'No queries yet'}
                </div>
              </div>
            ))}
          </>
        )}

        {sessions.length === 0 && (
          <div style={{ padding: '20px 8px', color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center' }}>
            No previous sessions.<br />Start a new research session above.
          </div>
        )}
      </div>

      <div className="sidebar-status">
        <div className="status-text">
          <span className={`status-dot ${ollamaStatus ? 'online' : 'offline'}`} />
          Ollama LLM: {ollamaStatus ? 'Connected' : 'Offline'}
        </div>
        <div className="status-text" style={{ marginTop: 4 }}>
          <span className="status-dot online" />
          APIs: PubMed · OpenAlex · ClinicalTrials
        </div>
      </div>
    </aside>
  );
}

// ─── Welcome Screen ───────────────────────────────────────────────────────────
function WelcomeScreen({ onExampleClick }) {
  const examples = [
    { disease: 'Lung Cancer', query: 'Vitamin D deficiency correlation' },
    { disease: 'Alzheimer\'s Disease', query: 'latest amyloid beta treatments' },
    { disease: 'Diabetes Type 2', query: 'GLP-1 receptor agonist trials' },
    { disease: 'Breast Cancer', query: 'HER2 targeted immunotherapy' },
    { disease: 'COVID-19', query: 'long COVID neurological symptoms' },
    { disease: 'Parkinson\'s Disease', query: 'alpha-synuclein gene therapy' },
  ];

  return (
    <div className="welcome-screen">
      <div className="welcome-icon">🧬</div>
      <h1 className="welcome-title">Curalink Research Assistant</h1>
      <p className="welcome-subtitle">
        Deep medical research powered by PubMed, OpenAlex, ClinicalTrials.gov,
        and local AI reasoning. Ask anything about diseases, treatments, or trials.
      </p>

      <div style={{ display: 'flex', gap: 20, marginBottom: 8, color: 'var(--text-muted)', fontSize: '0.78rem' }}>
        <span>📡 50–150 papers retrieved</span>
        <span>🏆 AI-ranked results</span>
        <span>🧠 Local LLM reasoning</span>
        <span>🔄 Context-aware</span>
      </div>

      <div className="welcome-chips">
        {examples.map((ex, i) => (
          <div
            key={i}
            className="welcome-chip"
            onClick={() => onExampleClick(ex)}
          >
            <strong>{ex.disease}</strong>: {ex.query}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Loading Stage Cycle ──────────────────────────────────────────────────────
const LOADING_STAGES = [
  'Expanding query with disease context...',
  'Fetching from PubMed (esearch + efetch)...',
  'Fetching from OpenAlex API...',
  'Fetching from ClinicalTrials.gov...',
  'Ranking publications by relevance + recency...',
  'Selecting top publications and trials...',
  'Generating AI analysis with Ollama...',
  'Structuring final response...',
];

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [sessionId, setSessionId] = useState(() => {
    return localStorage.getItem('curalink_session') || uuidv4();
  });
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState('');
  const [contextDisease, setContextDisease] = useState('');
  const [sessions, setSessions] = useState([]);
  const [ollamaStatus, setOllamaStatus] = useState(false);
  const chatEndRef = useRef(null);
  const stageInterval = useRef(null);

  // Persist session
  useEffect(() => {
    localStorage.setItem('curalink_session', sessionId);
  }, [sessionId]);

  // Load conversation on mount / session change
  useEffect(() => {
    loadHistory(sessionId);
  }, [sessionId]);

  // Check Ollama health
  useEffect(() => {
    checkHealth().then(data => {
      setOllamaStatus(data?.ollama?.available || false);
    });
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function loadHistory(sid) {
    try {
      const data = await getConversationHistory(sid);
      if (data.success) {
        // Convert DB messages to display format
        const displayMessages = [];
        for (const msg of data.messages || []) {
          if (msg.role === 'user') {
            displayMessages.push({
              role: 'user',
              content: msg.content,
              disease: msg.disease,
              location: msg.location,
              timestamp: msg.timestamp,
            });
          } else {
            displayMessages.push({
              role: 'assistant',
              content: msg.content,
              sources: msg.sources || { publications: [], clinicalTrials: [] },
              timestamp: msg.timestamp,
            });
          }
        }
        setMessages(displayMessages);
        setContextDisease(data.disease || '');
      }
    } catch (err) {
      console.error('History load error:', err);
    }
  }

  function startLoadingCycle() {
    let idx = 0;
    setLoadingStage(LOADING_STAGES[0]);
    stageInterval.current = setInterval(() => {
      idx = (idx + 1) % LOADING_STAGES.length;
      setLoadingStage(LOADING_STAGES[idx]);
    }, 2500);
  }

  function stopLoadingCycle() {
    if (stageInterval.current) {
      clearInterval(stageInterval.current);
      stageInterval.current = null;
    }
  }

  const handleSubmit = useCallback(async ({ disease, query, location }) => {
    if (loading) return;

    // Add user message immediately
    const userMsg = {
      role: 'user',
      content: query || disease,
      disease,
      location,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    startLoadingCycle();

    try {
      const result = await sendResearchQuery({ disease, query, location, sessionId });

      if (result.success) {
        const assistantMsg = {
          role: 'assistant',
          content: result.aiResponse,
          sources: result.sources,
          metadata: result.metadata,
          llmError: result.llmError,
          timestamp: result.timestamp,
        };
        setMessages(prev => [...prev, assistantMsg]);
        setContextDisease(result.disease || disease);

        // Update sidebar sessions
        setSessions(prev => {
          const exists = prev.find(s => s.sessionId === sessionId);
          if (exists) {
            return prev.map(s =>
              s.sessionId === sessionId
                ? { ...s, disease: result.disease || disease, lastQuery: query }
                : s
            );
          }
          return [{ sessionId, disease: result.disease || disease, lastQuery: query }, ...prev];
        });
      } else {
        throw new Error(result.error || 'Query failed');
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `## ❌ Error\n${err.message}\n\nPlease check that:\n• Backend is running on port 5000\n• MongoDB is connected\n• Ollama is running (optional for AI analysis)`,
        sources: { publications: [], clinicalTrials: [] },
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setLoading(false);
      stopLoadingCycle();
    }
  }, [sessionId, loading]);

  const handleExampleClick = useCallback((ex) => {
    handleSubmit({ disease: ex.disease, query: ex.query, location: '' });
  }, [handleSubmit]);

  const handleNewChat = useCallback(() => {
    const newId = uuidv4();
    setSessionId(newId);
    setMessages([]);
    setContextDisease('');
  }, []);

  const handleSelectSession = useCallback((sid) => {
    setSessionId(sid);
    setMessages([]);
  }, []);

  return (
    <div className="app-layout">
      <Sidebar
        sessions={sessions}
        currentSessionId={sessionId}
        onSelectSession={handleSelectSession}
        onNewChat={handleNewChat}
        ollamaStatus={ollamaStatus}
      />

      <main className="main-content">
        {/* Top bar */}
        <div className="topbar">
          <div className="topbar-title">
            🔬 Medical Research Pipeline &nbsp;·&nbsp;
            <span style={{ color: 'var(--accent-cyan)' }}>
              {contextDisease ? `🫁 Context: ${contextDisease}` : 'No disease context set'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="badge badge-blue">PubMed</span>
            <span className="badge badge-blue">OpenAlex</span>
            <span className="badge badge-amber">ClinicalTrials</span>
            <span className={`badge ${ollamaStatus ? 'badge-green' : 'badge-red'}`}>
              {ollamaStatus ? '🟢 Ollama' : '🔴 Ollama'}
            </span>
          </div>
        </div>

        {/* Chat area */}
        <div className="chat-area">
          {messages.length === 0 && !loading ? (
            <WelcomeScreen onExampleClick={handleExampleClick} />
          ) : (
            <MessageList
              messages={messages}
              loading={loading}
              loadingStage={loadingStage}
            />
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <InputForm
          onSubmit={handleSubmit}
          loading={loading}
          contextDisease={contextDisease}
        />
      </main>
    </div>
  );
}
