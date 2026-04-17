const axios = require("axios");
require("dotenv").config();

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3";

/**
 * Build structured medical research prompt
 */
function buildPrompt(
  disease,
  query,
  clusters,
  evidenceStrength,
  clinicalTrials,
  conversationHistory = [],
) {
  // Format clusters for prompt
  const clustersSection =
    clusters.length > 0
      ? clusters
          .map((c, i) => {
            const pubs = c.publications
              .map(
                (p, j) =>
                  `  [${i + 1}.${j + 1}] TITLE: ${p.title} (Year: ${p.year}) | SOURCE: ${p.source}
          ABSTRACT: ${(p.abstract || "").slice(0, 400)}...`,
              )
              .join("\n\n");
            return `CLUSTER ${i + 1}: ${c.theme}\n${pubs}`;
          })
          .join("\n\n")
      : "No research clusters available.";

  // Format clinical trials for prompt
  const trialSection =
    clinicalTrials.length > 0
      ? clinicalTrials
          .slice(0, 5)
          .map((t, i) => {
            return `[T${i + 1}] TRIAL TITLE: ${t.title}
STATUS: ${t.status} | PHASE: ${t.phase}
SUMMARY: ${(t.summary || "").slice(0, 300)}...`;
          })
          .join("\n\n")
      : "No clinical trials found.";

  // Format conversation history for context
  const historySection =
    conversationHistory.length > 0
      ? `PREVIOUS CONVERSATION:\n${conversationHistory
          .slice(-4)
          .map((m) => `${m.role.toUpperCase()}: ${m.content.slice(0, 200)}`)
          .join("\n")}\n\n`
      : "";

  const prompt = `You are an evidence-based medical research assistant.
Your responses must be STRICTLY based on the provided research data below. 
DO NOT hallucinate, invent, or guess any information.

${historySection}RESEARCH QUERY:
Disease/Condition: ${disease || "Not specified"}
User Question: ${query}
Overall Evidence Strength: ${evidenceStrength}

=== RESEARCH CLUSTERS (USE ONLY THESE) ===
${clustersSection}

=== CLINICAL TRIALS ===
${trialSection}

=== YOUR TASK ===
Use ONLY the provided research clusters.

For each claim:
* Cite at least one study
* Prefer recent studies
* Mention if evidence is conflicting

If evidence is weak, explicitly say:
'Current evidence is limited or inconclusive.'

FORMAT YOUR RESPONSE EXACTLY AS FOLLOWS (using Markdown headings):

## 1. Condition Overview
[Brief summary of the condition and query intent]

## 2. Key Findings
[Provide clustered insights based on the themes. Use bullet points and cite sources (e.g., [1.1])]

## 3. Evidence Strength
[State the exact Evidence Strength provided above. Add a brief 1 sentence explanation of why, based on the studies.]

## 4. Clinical Trials Summary
[Summarize relevant trials. If none, say "No clinical trials found."]

## 5. Practical Interpretation
[Safe, neutral interpretation. Conclude with a medical disclaimer.]

## 6. Sources
[List exactly 5 citations formatted cleanly]`;

  return prompt;
}

/**
 * Generate research response using Ollama
 */
async function generateResearchResponse(
  disease,
  query,
  clusters,
  evidenceStrength,
  clinicalTrials,
  conversationHistory = [],
) {
  try {
    // FAIL-SAFE LOGIC
    // If no strong/moderate papers found and no trials
    if (
      evidenceStrength === "Weak" &&
      clusters.length === 0 &&
      clinicalTrials.length === 0
    ) {
      return "Insufficient high-quality research found for this query.";
    }

    console.log(
      `[LLM] Generating response with ${clusters.length} clusters, ${clinicalTrials.length} trials`,
    );

    const prompt = buildPrompt(
      disease,
      query,
      clusters,
      evidenceStrength,
      clinicalTrials,
      conversationHistory,
    );

    const response = await axios.post(
      `${OLLAMA_BASE_URL}/api/generate`,
      {
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        options: {
          temperature: 0.2, // lowered temperature for clinical rigor
          top_p: 0.9,
          top_k: 40,
          repeat_penalty: 1.1,
          num_predict: 2048,
        },
      },
      { timeout: 120000 },
    );

    const text = response.data?.response || "";
    console.log("[LLM] Response generated successfully");
    return text;
  } catch (err) {
    if (err.code === "ECONNREFUSED") {
      throw new Error(
        "Ollama is not running. Please start Ollama with: ollama run llama3",
      );
    }
    if (err.response?.status === 404) {
      throw new Error(
        `Model "${OLLAMA_MODEL}" not found. Run: ollama pull ${OLLAMA_MODEL}`,
      );
    }
    throw new Error(`LLM generation failed: ${err.message}`);
  }
}

/**
 * Check if Ollama is available
 */
async function checkOllamaHealth() {
  try {
    const res = await axios.get(`${OLLAMA_BASE_URL}/api/tags`, {
      timeout: 5000,
    });
    const models = res.data?.models?.map((m) => m.name) || [];
    return { available: true, models };
  } catch {
    return { available: false, models: [] };
  }
}

module.exports = { generateResearchResponse, checkOllamaHealth, buildPrompt };
