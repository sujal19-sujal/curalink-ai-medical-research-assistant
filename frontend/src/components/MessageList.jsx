import React from 'react';
import MarkdownRenderer from './MarkdownRenderer';
import PublicationCard from './PublicationCard';
import ClinicalTrialCard from './ClinicalTrialCard';

function formatTime(ts) {
  return new Date(ts || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function UserMessage({ message }) {
  return (
    <div className="user-message animate-in">
      <div>
        <div className="user-meta">
          {message.disease && <span>🫁 {message.disease}</span>}
          {message.location && <span>📍 {message.location}</span>}
        </div>
        <div className="user-bubble">{message.content}</div>
      </div>
    </div>
  );
}

function AssistantMessage({ message }) {
  const pubs = message.sources?.publications || [];
  const trials = message.sources?.clinicalTrials || [];
  const meta = message.metadata || {};

  return (
    <div className="assistant-message animate-in">
      <div className="assistant-header">
        <div className="assistant-avatar">🧬</div>
        <span className="assistant-name">Curalink AI</span>
        <span className="assistant-time">{formatTime(message.timestamp)}</span>
        {meta.totalPublicationsFetched && (
          <>
            <span className="badge badge-blue">
              {meta.totalPublicationsFetched} papers fetched
            </span>
            <span className="badge badge-green">
              {meta.topPublicationsSelected} selected
            </span>
          </>
        )}
      </div>

      {/* LLM Error warning */}
      {message.llmError && (
        <div className="error-banner">
          ⚠️ Ollama unavailable — showing structured data summary. Start Ollama to enable AI analysis.
        </div>
      )}

      {/* Main AI Response */}
      <div className="ai-response-card">
        <div className="ai-response-body">
          <MarkdownRenderer content={message.content} />
        </div>

        {/* Metadata strip */}
        {meta.expandedQuery && (
          <div className="metadata-strip">
            <span className="badge badge-blue">🔍 "{meta.expandedQuery}"</span>
            {(meta.sources || []).map(s => (
              <span key={s} className="badge badge-amber">📡 {s}</span>
            ))}
          </div>
        )}
      </div>

      {/* Publications */}
      {pubs.length > 0 && (
        <div className="sources-section">
          <div className="sources-title">
            📚 Research Publications
            <span className="badge badge-blue">{pubs.length} selected</span>
          </div>
          <div className="publications-grid">
            {pubs.map((pub, i) => (
              <PublicationCard key={i} pub={pub} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* Clinical Trials */}
      {trials.length > 0 && (
        <div className="sources-section">
          <div className="sources-title">
            🏥 Clinical Trials
            <span className="badge badge-green">{trials.length} found</span>
          </div>
          <div className="trials-grid">
            {trials.map((trial, i) => (
              <ClinicalTrialCard key={i} trial={trial} index={i} />
            ))}
          </div>
        </div>
      )}

      {pubs.length === 0 && trials.length === 0 && (
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '8px 0' }}>
          ℹ️ No research sources retrieved for this query.
        </div>
      )}
    </div>
  );
}

function LoadingMessage({ stage }) {
  const stages = [
    'Expanding query...',
    'Fetching from PubMed...',
    'Fetching from OpenAlex...',
    'Fetching ClinicalTrials.gov...',
    'Ranking publications...',
    'Generating AI analysis...',
  ];

  return (
    <div className="assistant-message animate-in">
      <div className="assistant-header">
        <div className="assistant-avatar" style={{ animation: 'pulse 1s infinite' }}>🧬</div>
        <span className="assistant-name">Curalink AI</span>
        <span className="badge badge-amber">Processing...</span>
      </div>
      <div className="loading-indicator">
        <div className="loading-dots">
          <div className="loading-dot" />
          <div className="loading-dot" />
          <div className="loading-dot" />
        </div>
        <div>
          <div className="loading-text">Running research pipeline</div>
          <div className="loading-stage">{stage || stages[0]}</div>
        </div>
      </div>
    </div>
  );
}

export default function MessageList({ messages, loading, loadingStage }) {
  return (
    <>
      {messages.map((msg, i) => (
        <div key={i} className="message-group">
          {msg.role === 'user' ? (
            <UserMessage message={msg} />
          ) : (
            <AssistantMessage message={msg} />
          )}
        </div>
      ))}
      {loading && <LoadingMessage stage={loadingStage} />}
    </>
  );
}
