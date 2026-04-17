import React, { useState, useRef, useEffect } from 'react';

export default function InputForm({ onSubmit, loading, contextDisease }) {
  const [disease, setDisease] = useState('');
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  const textareaRef = useRef(null);

  // Auto-populate disease from context
  useEffect(() => {
    if (contextDisease && !disease) {
      setDisease(contextDisease);
    }
  }, [contextDisease]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if ((!disease && !query) || loading) return;
    onSubmit({ disease: disease.trim(), query: query.trim(), location: location.trim() });
    setQuery('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Auto-resize textarea
  const handleQueryChange = (e) => {
    setQuery(e.target.value);
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 140) + 'px';
    }
  };

  const exampleQueries = [
    { disease: 'Lung Cancer', query: 'Vitamin D therapy effectiveness' },
    { disease: 'Diabetes Type 2', query: 'SGLT2 inhibitors recent trials' },
    { disease: 'Alzheimer\'s', query: 'amyloid beta treatment research' },
    { disease: 'COVID-19', query: 'long COVID neurological effects' },
  ];

  return (
    <div className="input-area">
      <form className="input-form" onSubmit={handleSubmit}>
        {/* Disease + Location row */}
        <div className="input-fields-row">
          <input
            className="input-field"
            type="text"
            placeholder="🫁 Disease / Condition (e.g. Lung Cancer)"
            value={disease}
            onChange={e => setDisease(e.target.value)}
            id="disease-input"
          />
          <input
            className="input-field"
            type="text"
            placeholder="📍 Location (optional, e.g. USA)"
            value={location}
            onChange={e => setLocation(e.target.value)}
            id="location-input"
            style={{ maxWidth: 200 }}
          />
        </div>

        {/* Query + Send row */}
        <div className="input-main-row">
          <textarea
            ref={textareaRef}
            className="input-textarea"
            placeholder="Ask a research question... (e.g. What are the latest clinical trials for EGFR inhibitors?)"
            value={query}
            onChange={handleQueryChange}
            onKeyDown={handleKeyDown}
            rows={1}
            id="query-input"
            disabled={loading}
          />
          <button
            type="submit"
            className="send-btn"
            disabled={loading || (!disease && !query)}
            id="send-btn"
            title="Send research query"
          >
            {loading ? '⏳' : '🚀'}
          </button>
        </div>

        {/* Example chips (show only when no disease set) */}
        {!disease && !loading && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            {exampleQueries.map((ex, i) => (
              <button
                key={i}
                type="button"
                className="welcome-chip"
                onClick={() => { setDisease(ex.disease); setQuery(ex.query); }}
                style={{ fontSize: '0.72rem' }}
              >
                {ex.disease}: {ex.query.slice(0, 30)}…
              </button>
            ))}
          </div>
        )}

        <div className="input-hint">
          Press Enter to send · Shift+Enter for new line · Disease context is remembered across messages
        </div>
      </form>
    </div>
  );
}
