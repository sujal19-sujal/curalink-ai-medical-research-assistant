/**
 * Query Builder Service
 * Expands raw disease + query inputs into optimized search queries
 * for different APIs.
 */

// Dictionary for medical synonyms
const SYNONYMS = {
  "vitamin d": ["calciferol", "cholecalciferol", "ergocalciferol"],
  "lung cancer": ["pulmonary carcinoma", "NSCLC", "SCLC", "lung neoplasm"],
  "heart attack": ["myocardial infarction", "MI"],
  stroke: ["cerebrovascular accident", "CVA"],
  "covid-19": ["sars-cov-2", "coronavirus"],
  cancer: ["carcinoma", "malignancy", "neoplasm"],
};

// Intent mappings
const INTENTS = {
  treatment: [
    "treatment",
    "therapy",
    "intervention",
    "cure",
    "surgery",
    "management",
  ],
  drug: ["drug", "medication", "dose", "pharmacology", "pill"],
  clinical_trials: [
    "clinical trial",
    "phase study",
    "randomized",
    "placebo",
    "trial",
  ],
  nutrition: ["diet", "nutrition", "supplement", "vitamin", "food"],
  prognosis: [
    "prognosis",
    "survival",
    "mortality",
    "outcome",
    "risk",
    "life expectancy",
  ],
};

/**
 * Expand a term using synonyms
 */
function expandWithSynonyms(term) {
  if (!term) return "";
  const lower = term.toLowerCase();
  for (const [key, syns] of Object.entries(SYNONYMS)) {
    if (lower.includes(key)) {
      return `(${term} OR ${syns.join(" OR ")})`;
    }
  }
  return term;
}

/**
 * Build an expanded query string from disease + user query input
 * @param {string} disease
 * @param {string} query
 * @returns {string} expanded query
 */
function buildExpandedQuery(disease, query) {
  const expandedDisease = expandWithSynonyms(disease);
  const expandedQuery = expandWithSynonyms(query);

  if (!expandedDisease && !expandedQuery) return "";

  if (expandedDisease && expandedQuery) {
    return `${expandedQuery} AND ${expandedDisease} clinical research`;
  }
  if (expandedDisease) {
    return `${expandedDisease} clinical research treatment`;
  }
  return expandedQuery;
}

/**
 * Build PubMed-specific search term
 */
function buildPubMedQuery(disease, query) {
  const base = buildExpandedQuery(disease, query);
  return `${base}[Title/Abstract]`;
}

/**
 * Build OpenAlex-specific search query
 */
function buildOpenAlexQuery(disease, query) {
  return buildExpandedQuery(disease, query);
}

/**
 * Build ClinicalTrials.gov query
 */
function buildClinicalTrialsQuery(disease, query, location) {
  return {
    condition: disease
      ? expandWithSynonyms(disease)
      : expandWithSynonyms(query),
    query: query,
    location: location || "",
  };
}

/**
 * Parse free-form natural language input into structured components
 */
function parseNaturalLanguage(text) {
  const lower = text.toLowerCase();

  let detectedIntent = "general";

  for (const [intentType, keywords] of Object.entries(INTENTS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      detectedIntent = intentType;
      break;
    }
  }

  return {
    disease: null, // fallback: let the controller/LLM handle condition extraction from text if needed
    query: text,
    intent: detectedIntent,
  };
}

module.exports = {
  buildExpandedQuery,
  buildPubMedQuery,
  buildOpenAlexQuery,
  buildClinicalTrialsQuery,
  parseNaturalLanguage,
};
