/**
 * Clustering Engine
 * Groups publications into distinct thematic clusters based on their contents
 * and determines the overall strength of evidence.
 */

function clusterResearch(publications) {
  if (!publications || publications.length === 0) {
    return {
      clusters: [],
      evidenceStrength: "Weak", // No studies found
    };
  }

  // Simple heuristic clustering logic based on keywords in titles and abstracts
  const themes = {
    "Treatment & Efficacy": [
      "treatment",
      "therapy",
      "efficacy",
      "effective",
      "cure",
      "intervention",
      "management",
      "supplementation",
    ],
    "Clinical Outcomes & Trials": [
      "trial",
      "outcome",
      "randomized",
      "placebo",
      "cohort",
      "phase",
      "study",
    ],
    "Mechanism & Correlation": [
      "mechanism",
      "correlation",
      "association",
      "pathway",
      "deficiency",
      "risk",
      "factor",
      "pathogenesis",
    ],
    "Reviews & Meta-Analysis": [
      "review",
      "meta-analysis",
      "systematic",
      "overview",
      "literature",
    ],
  };

  const clustersMap = {
    "Treatment & Efficacy": [],
    "Clinical Outcomes & Trials": [],
    "Mechanism & Correlation": [],
    "Reviews & Meta-Analysis": [],
    "General Findings": [],
  };

  const currentYear = new Date().getFullYear();
  let recentHighQualityCount = 0;
  let olderMixedCount = 0;

  publications.forEach((pub) => {
    const textBlob = `${pub.title || ""} ${pub.abstract || ""}`.toLowerCase();

    // Check evidence strength metrics
    const age = currentYear - (pub.year || 2000);
    // Determine if it represents string evidence. (Since our score range is ~[0,1])
    if (age <= 5 && (pub._score > 0.4 || pub._semanticSimilarity > 0.6)) {
      recentHighQualityCount++;
    } else {
      olderMixedCount++;
    }

    // Assign to cluster
    let assigned = false;
    for (const [theme, keywords] of Object.entries(themes)) {
      if (keywords.some((kw) => textBlob.includes(kw))) {
        clustersMap[theme].push(pub);
        assigned = true;
        break; // assign to first matched theme
      }
    }

    if (!assigned) {
      clustersMap["General Findings"].push(pub);
    }
  });

  // Calculate overall evidence strength
  let evidenceStrength = "Weak";

  if (recentHighQualityCount >= 3) {
    evidenceStrength = "Strong";
  } else if (recentHighQualityCount > 0 || olderMixedCount >= 3) {
    evidenceStrength = "Moderate";
  }

  // Format clusters for output
  const formattedClusters = Object.entries(clustersMap)
    .filter(([_, pubs]) => pubs.length > 0)
    .map(([theme, pubs]) => ({
      theme,
      publications: pubs,
    }));

  return {
    clusters: formattedClusters,
    evidenceStrength,
  };
}

module.exports = { clusterResearch };
