const Conversation = require("../models/Conversation");
const {
  buildExpandedQuery,
  buildPubMedQuery,
  buildOpenAlexQuery,
  buildClinicalTrialsQuery,
  parseNaturalLanguage,
} = require("../services/queryBuilder");
const { fetchPubMedArticles } = require("../services/pubmedService");
const { fetchOpenAlexWorks } = require("../services/openalexService");
const { fetchClinicalTrials } = require("../services/clinicalTrialService");
const { rankPublications, rankTrials } = require("../services/rankingEngine");
const {
  generateResearchResponse,
  checkOllamaHealth,
} = require("../services/llmService");

// ─── MongoDB helpers (graceful fallbacks when DB is unavailable) ──────────────

async function loadConversation(sessionId) {
  try {
    return await Conversation.findOne({ sessionId });
  } catch {
    return null;
  }
}

async function saveConversation(conversation) {
  try {
    await conversation.save();
  } catch {
    // Silently skip — DB unavailable
  }
}

async function findOrCreateConversation(sessionId, disease, location) {
  try {
    let conv = await Conversation.findOne({ sessionId });
    if (!conv) {
      conv = new Conversation({ sessionId, disease, location, messages: [] });
    }
    return conv;
  } catch {
    // Return a plain in-memory object when MongoDB is down
    return { sessionId, disease, location, messages: [], _inMemory: true };
  }
}

// ─── Main pipeline handler ────────────────────────────────────────────────────

async function handleResearchQuery(req, res) {
  try {
    const { disease, query, location, sessionId, naturalLanguage } = req.body;

    if (!sessionId) {
      return res
        .status(400)
        .json({ success: false, error: "sessionId is required" });
    }

    // Parse natural language if no structured inputs
    let effectiveDisease = disease;
    let effectiveQuery = query;

    if (naturalLanguage && !disease && !query) {
      const parsed = parseNaturalLanguage(naturalLanguage);
      effectiveDisease = parsed.disease;
      effectiveQuery = parsed.query;
    }

    if (!effectiveQuery && !effectiveDisease) {
      return res
        .status(400)
        .json({
          success: false,
          error: "Provide disease/query or naturalLanguage",
        });
    }

    // Load conversation context (graceful — works without MongoDB)
    const conversation = await findOrCreateConversation(
      sessionId,
      effectiveDisease,
      location,
    );

    // For follow-ups: inherit disease from context
    if (!effectiveDisease && conversation.disease) {
      effectiveDisease = conversation.disease;
      console.log(
        `[Controller] Using disease from context: ${effectiveDisease}`,
      );
    } else if (effectiveDisease) {
      conversation.disease = effectiveDisease;
    }

    if (location) conversation.location = location;

    // Get conversation history for LLM context (last 6 turns)
    const conversationHistory = (conversation.messages || [])
      .slice(-6)
      .map((m) => ({
        role: m.role,
        content: m.content,
      }));

    // Store user message (in memory or DB)
    conversation.messages.push({
      role: "user",
      content: effectiveQuery || effectiveDisease,
      disease: effectiveDisease,
      query: effectiveQuery,
      location,
    });

    console.log(`\n=== Pipeline Start ===`);
    console.log(
      `Disease: ${effectiveDisease} | Query: ${effectiveQuery} | Location: ${location}`,
    );

    // === STEP 2: QUERY EXPANSION ===
    const pubMedQuery = buildPubMedQuery(effectiveDisease, effectiveQuery);
    const openAlexQuery = buildOpenAlexQuery(effectiveDisease, effectiveQuery);
    const ctQuery = buildClinicalTrialsQuery(
      effectiveDisease,
      effectiveQuery,
      location || conversation.location,
    );

    // === STEP 3: DEEP RETRIEVAL (parallel) ===
    console.log("[Pipeline] Starting parallel deep retrieval...");
    const [pubmedResults, openalexResults, trialResults] =
      await Promise.allSettled([
        fetchPubMedArticles(pubMedQuery, 50),
        fetchOpenAlexWorks(openAlexQuery, 50),
        fetchClinicalTrials(ctQuery, 50),
      ]);

    const pubmedArticles =
      pubmedResults.status === "fulfilled" ? pubmedResults.value : [];
    const openalexArticles =
      openalexResults.status === "fulfilled" ? openalexResults.value : [];
    const clinicalTrials =
      trialResults.status === "fulfilled" ? trialResults.value : [];

    // === STEP 4: NORMALIZATION (done inside each service) ===
    const allPublications = [...pubmedArticles, ...openalexArticles];
    console.log(
      `[Pipeline] Fetched: ${pubmedArticles.length} PubMed, ${openalexArticles.length} OpenAlex, ${clinicalTrials.length} Trials`,
    );

    // === STEP 5 & 6: RANKING + TOP SELECTION ===
    const topPublications = await rankPublications(
      allPublications,
      effectiveQuery,
      effectiveDisease,
      8,
    );
    const topTrials = rankTrials(
      clinicalTrials,
      effectiveQuery,
      effectiveDisease,
      6,
    );

    // Provide a confidence score = avg of top 3 scores
    let confidenceScore = 0;
    if (topPublications.length > 0) {
      const top3 = topPublications.slice(0, 3);
      const sumScore = top3.reduce((acc, p) => acc + (p._score || 0), 0);
      // Score gets normalized ~ max 1. Treat as percentage.
      confidenceScore = Math.round((sumScore / top3.length) * 100);
      // Cap at 99%
      if (confidenceScore > 99) confidenceScore = 99;
    }

    console.log(
      `[Pipeline] Ranked → ${topPublications.length} pubs, ${topTrials.length} trials`,
    );

    // === STEP 6B: CLUSTERING ===
    const { clusterResearch } = require("../services/clusteringEngine");
    const { clusters, evidenceStrength } = clusterResearch(topPublications);

    // === STEP 7: LLM REASONING ===
    let llmResponse = "";
    let llmError = null;

    try {
      llmResponse = await generateResearchResponse(
        effectiveDisease,
        effectiveQuery,
        clusters,
        evidenceStrength,
        topTrials,
        conversationHistory,
      );
    } catch (err) {
      console.error("[Pipeline] LLM Error:", err.message);
      llmError = err.message;
      llmResponse = generateFallbackResponse(
        effectiveDisease,
        effectiveQuery,
        topPublications,
        topTrials,
      );
    }

    // === STEP 8: STRUCTURED OUTPUT ===
    const structuredResponse = {
      success: true,
      sessionId,
      disease: effectiveDisease,
      query: effectiveQuery,
      aiResponse: llmResponse,
      confidence: confidenceScore,
      evidenceStrength: evidenceStrength,
      llmError,
      sources: {
        publications: topPublications,
        clinicalTrials: topTrials,
      },
      metadata: {
        totalPublicationsFetched: allPublications.length,
        totalTrialsFetched: clinicalTrials.length,
        topPublicationsSelected: topPublications.length,
        topTrialsSelected: topTrials.length,
        expandedQuery: buildExpandedQuery(effectiveDisease, effectiveQuery),
        sources: ["PubMed", "OpenAlex", "ClinicalTrials.gov"],
        mongoAvailable: !conversation._inMemory,
      },
      timestamp: new Date().toISOString(),
    };

    // === STEP 9: CONTEXT MEMORY — persist to MongoDB if available ===
    conversation.messages.push({
      role: "assistant",
      content: llmResponse,
      sources: {
        publications: topPublications.slice(0, 3),
        clinicalTrials: topTrials.slice(0, 2),
      },
    });

    if (!conversation._inMemory) {
      await saveConversation(conversation);
    }

    return res.json(structuredResponse);
  } catch (err) {
    console.error("[Controller] Fatal error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

// ─── Other endpoints ──────────────────────────────────────────────────────────

async function getConversationHistory(req, res) {
  try {
    const { sessionId } = req.params;
    const conversation = await loadConversation(sessionId);

    if (!conversation) {
      return res.json({ success: true, messages: [], disease: null });
    }

    return res.json({
      success: true,
      sessionId,
      disease: conversation.disease,
      location: conversation.location,
      messages: conversation.messages,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function clearConversation(req, res) {
  try {
    const { sessionId } = req.params;
    await Conversation.findOneAndDelete({ sessionId });
    return res.json({ success: true, message: "Conversation cleared" });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function healthCheck(req, res) {
  const ollamaStatus = await checkOllamaHealth();
  return res.json({
    success: true,
    ollama: ollamaStatus,
    mongo: global.mongoAvailable ? "connected" : "unavailable",
    timestamp: new Date().toISOString(),
  });
}

// ─── Fallback when Ollama is offline ─────────────────────────────────────────

function generateFallbackResponse(disease, query, publications, trials) {
  const insightLines = publications
    .slice(0, 5)
    .map(
      (p, i) =>
        `• **Finding ${i + 1}**: ${(p.abstract || "").slice(0, 220)}... *(${p.authors}, ${p.year})*`,
    )
    .join("\n");

  const trialLines =
    trials.length > 0
      ? trials
          .slice(0, 3)
          .map(
            (t) =>
              `• **${t.title}** — Status: ${t.status} | Phase: ${t.phase} | [View ↗](${t.url})`,
          )
          .join("\n")
      : "• No clinical trials found for this query.";

  return `## 🔬 Condition Overview
Based on deep retrieval for **"${disease || query}"**, ${publications.length} peer-reviewed publications and ${trials.length} clinical trials were found and ranked.

## 📚 Research Insights
${insightLines || "• No publications with abstracts were retrieved."}

## 🏥 Clinical Trials
${trialLines}

## 📝 Summary & Recommendations
${publications.length} publications (PubMed + OpenAlex) and ${trials.length} clinical trials retrieved. Use the source cards below to explore each paper directly.

> ⚠️ **AI analysis unavailable** — Ollama LLM is not running. Start it with: \`ollama run llama3\``;
}

module.exports = {
  handleResearchQuery,
  getConversationHistory,
  clearConversation,
  healthCheck,
};
