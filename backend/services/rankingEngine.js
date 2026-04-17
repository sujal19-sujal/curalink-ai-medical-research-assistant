/**
 * Ranking Engine
 * Scores and ranks publications by relevance, recency, and keyword match + Semantic similarity.
 */

const { pipeline, cos_sim } = require("@xenova/transformers");

// Cache the transformer model
class EmbedderSingleton {
  static task = "feature-extraction";
  static model = "Xenova/all-MiniLM-L6-v2";
  static instance = null;

  static async getInstance() {
    if (this.instance === null) {
      this.instance = await pipeline(this.task, this.model);
    }
    return this.instance;
  }
}

/**
 * Score base components
 */
function computeBasePubScores(item, query, disease) {
  let kwScore = 0;
  let sourceScore = 0;
  const currentYear = new Date().getFullYear();

  const titleLower = (item.title || "").toLowerCase();
  const abstractLower = (item.abstract || "").toLowerCase();
  const keywords = buildKeywords(query, disease);

  // 1. Keyword match in title and abstract
  for (const kw of keywords) {
    if (titleLower.includes(kw)) kwScore += 10;
    if (abstractLower.includes(kw)) kwScore += 5;
  }

  // 2. Recency scoring (year-based)
  let recencyScore = 0;
  const year = item.year || 2000;
  const agePenalty = currentYear - year;
  if (agePenalty <= 1) recencyScore = 20;
  else if (agePenalty <= 3) recencyScore = 15;
  else if (agePenalty <= 5) recencyScore = 10;
  else if (agePenalty <= 10) recencyScore = 5;

  // 3. Source preference & abstract presence
  if (item.abstract && item.abstract !== "No abstract available.")
    sourceScore += 2;
  if (item.url) sourceScore += 1;
  if (item.sourceType === "pubmed") sourceScore += 2;

  return { kwScore, recencyScore, sourceScore };
}

/**
 * Build keyword list from query and disease
 */
function buildKeywords(query, disease) {
  const combined = `${query || ""} ${disease || ""}`.toLowerCase();
  const stopwords = new Set([
    "and",
    "or",
    "the",
    "in",
    "of",
    "a",
    "an",
    "for",
    "with",
    "on",
    "at",
    "to",
    "is",
    "are",
  ]);
  return combined
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9]/g, ""))
    .filter((w) => w.length > 2 && !stopwords.has(w));
}

/**
 * Rank and filter a list of publications
 * @param {Array} items - all fetched publications
 * @param {string} query
 * @param {string} disease
 * @param {number} topN - how many to return
 */
async function rankPublications(items, query, disease, topN = 8) {
  // Remove duplicates by title similarity
  const seen = new Set();
  const unique = items.filter((item) => {
    const key = (item.title || "").toLowerCase().slice(0, 60);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const embedder = await EmbedderSingleton.getInstance();
  const queryText = `${query || ""} ${disease || ""}`.trim();
  let queryEmbedding = null;
  if (queryText) {
    const out = await embedder(queryText, { pooling: "mean", normalize: true });
    queryEmbedding = out.data;
  }

  // Score each
  const scored = await Promise.all(
    unique.map(async (item) => {
      const { kwScore, recencyScore, sourceScore } = computeBasePubScores(
        item,
        query,
        disease,
      );
      let semanticScore = 0;

      if (
        queryEmbedding &&
        item.abstract &&
        item.abstract !== "No abstract available."
      ) {
        // Chunk abstract to prevent max length issues
        const textToEmbed = item.abstract.substring(0, 512);
        const out = await embedder(textToEmbed, {
          pooling: "mean",
          normalize: true,
        });
        semanticScore = cos_sim(queryEmbedding, out.data);
      }

      // Normalize max scores
      const normalizedKw = Math.min(kwScore / 30, 1);
      const normalizedRecency = Math.min(recencyScore / 20, 1);
      const normalizedSource = Math.min(sourceScore / 5, 1);
      // User requested formula: 0.35 * keyword + 0.25 * recency + 0.25 * semantic_similarity + 0.15 * source_quality
      const finalScore =
        0.35 * normalizedKw +
        0.25 * normalizedRecency +
        0.25 * Math.max(semanticScore, 0) +
        0.15 * normalizedSource;

      return {
        ...item,
        _score: finalScore,
        _semanticSimilarity: semanticScore,
      };
    }),
  );

  // Sort by score descending
  scored.sort((a, b) => b._score - a._score);
  return scored.slice(0, topN);
}

/**
 * Score a clinical trial
 */
function scoreTrial(trial, query, disease) {
  let score = 0;
  const titleLower = (trial.title || "").toLowerCase();
  const summaryLower = (trial.summary || "").toLowerCase();
  const keywords = buildKeywords(query, disease);

  // Keyword match
  for (const kw of keywords) {
    if (titleLower.includes(kw)) score += 10;
    if (summaryLower.includes(kw)) score += 4;
  }

  // Status scoring
  if (trial.status === "RECRUITING") score += 15;
  else if (trial.status === "ACTIVE_NOT_RECRUITING") score += 10;
  else if (trial.status === "COMPLETED") score += 8;

  // Phase scoring
  if ((trial.phase || "").includes("3") || (trial.phase || "").includes("4"))
    score += 8;
  else if ((trial.phase || "").includes("2")) score += 5;

  return score;
}

/**
 * Rank and filter clinical trials
 */
function rankTrials(trials, query, disease, topN = 6) {
  const scored = trials.map((trial) => ({
    ...trial,
    _score: scoreTrial(trial, query, disease),
  }));

  scored.sort((a, b) => b._score - a._score);
  return scored.slice(0, topN);
}

module.exports = { rankPublications, rankTrials, scoreTrial };
