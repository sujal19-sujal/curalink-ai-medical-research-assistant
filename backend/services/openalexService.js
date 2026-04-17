const axios = require('axios');
require('dotenv').config();

const BASE_URL = process.env.OPENALEX_BASE_URL;

/**
 * Fetch works from OpenAlex API
 * @param {string} query - expanded search query
 * @param {number} maxResults - total results to fetch (up to 200)
 * @returns {Array} normalized publications
 */
async function fetchOpenAlexWorks(query, maxResults = 50) {
  try {
    console.log(`[OpenAlex] Searching: "${query}" (max ${maxResults})`);

    const perPage = Math.min(maxResults, 50);
    const pages = Math.ceil(maxResults / perPage);
    const allWorks = [];

    for (let page = 1; page <= pages; page++) {
      const res = await axios.get(`${BASE_URL}/works`, {
        params: {
          search: query,
          'per-page': perPage,
          page,
          filter: 'has_abstract:true',
          select: 'id,title,abstract_inverted_index,authorships,publication_year,primary_location,doi,open_access',
          sort: 'relevance_score:desc',
        },
        timeout: 15000,
        headers: {
          'User-Agent': 'curalink-research-app/1.0 (mailto:curalink@example.com)',
        },
      });

      const works = res.data?.results || [];
      if (works.length === 0) break;

      const normalized = works.map(normalizeOpenAlexWork);
      allWorks.push(...normalized);

      // Rate limiting
      await sleep(200);
    }

    console.log(`[OpenAlex] Successfully fetched ${allWorks.length} works`);
    return allWorks;
  } catch (err) {
    console.error('[OpenAlex] Error:', err.message);
    return [];
  }
}

/**
 * Convert inverted index abstract to plain text
 */
function reconstructAbstract(invertedIndex) {
  if (!invertedIndex || typeof invertedIndex !== 'object') return '';

  try {
    const wordPositions = [];
    for (const [word, positions] of Object.entries(invertedIndex)) {
      for (const pos of positions) {
        wordPositions.push({ word, pos });
      }
    }
    wordPositions.sort((a, b) => a.pos - b.pos);
    return wordPositions.map(wp => wp.word).join(' ');
  } catch {
    return '';
  }
}

/**
 * Normalize a single OpenAlex work object
 */
function normalizeOpenAlexWork(work) {
  const abstract = reconstructAbstract(work.abstract_inverted_index);

  const authors = (work.authorships || [])
    .slice(0, 5)
    .map(a => a.author?.display_name || '')
    .filter(Boolean);

  const authorStr = authors.length > 3
    ? authors.slice(0, 3).join(', ') + ' et al.'
    : authors.join(', ') || 'Unknown Authors';

  const journal = work.primary_location?.source?.display_name || 'OpenAlex';
  const url = work.doi
    ? `https://doi.org/${work.doi}`
    : work.id || '';

  return {
    title: work.title || 'Untitled',
    abstract: abstract || 'No abstract available.',
    authors: authorStr,
    year: work.publication_year || new Date().getFullYear(),
    source: journal,
    url,
    sourceType: 'openalex',
    openAccessUrl: work.open_access?.oa_url || '',
  };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { fetchOpenAlexWorks };
