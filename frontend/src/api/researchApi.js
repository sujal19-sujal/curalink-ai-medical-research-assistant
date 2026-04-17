const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

/**
 * Send a research query to the backend pipeline
 */
export async function sendResearchQuery({ disease, query, location, sessionId }) {
  const res = await fetch(`${BASE_URL}/research/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ disease, query, location, sessionId }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Network error' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json();
}

/**
 * Load conversation history by sessionId
 */
export async function getConversationHistory(sessionId) {
  const res = await fetch(`${BASE_URL}/research/history/${sessionId}`);
  if (!res.ok) throw new Error('Failed to load history');
  return res.json();
}

/**
 * Clear conversation history
 */
export async function clearConversation(sessionId) {
  const res = await fetch(`${BASE_URL}/research/history/${sessionId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to clear conversation');
  return res.json();
}

/**
 * Check backend + Ollama health
 */
export async function checkHealth() {
  try {
    const res = await fetch(`${BASE_URL}/research/health`, { signal: AbortSignal.timeout(5000) });
    return res.json();
  } catch {
    return { success: false, ollama: { available: false } };
  }
}
