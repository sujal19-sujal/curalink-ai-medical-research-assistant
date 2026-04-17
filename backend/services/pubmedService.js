const axios = require('axios');
require('dotenv').config();

const BASE_URL = process.env.PUBMED_BASE_URL;

/**
 * Search PubMed using esearch, then fetch details with efetch
 * @param {string} query - expanded search query
 * @param {number} maxResults
 * @returns {Array} normalized publications
 */
async function fetchPubMedArticles(query, maxResults = 50) {
  try {
    console.log(`[PubMed] Searching: "${query}" (max ${maxResults})`);

    // Step 1: Get IDs via esearch
    const searchRes = await axios.get(`${BASE_URL}/esearch.fcgi`, {
      params: {
        db: 'pubmed',
        term: query,
        retmax: maxResults,
        retmode: 'json',
        sort: 'relevance',
      },
      timeout: 15000,
    });

    const ids = searchRes.data?.esearchresult?.idlist || [];
    if (ids.length === 0) {
      console.log('[PubMed] No results found');
      return [];
    }

    console.log(`[PubMed] Found ${ids.length} IDs, fetching details...`);

    // Step 2: Fetch details via efetch (batched)
    const batchSize = 50;
    const allArticles = [];

    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      const fetchRes = await axios.get(`${BASE_URL}/efetch.fcgi`, {
        params: {
          db: 'pubmed',
          id: batch.join(','),
          retmode: 'xml',
          rettype: 'abstract',
        },
        timeout: 20000,
      });

      const parsed = parsePubMedXML(fetchRes.data);
      allArticles.push(...parsed);

      // Rate limit respect
      await sleep(300);
    }

    console.log(`[PubMed] Successfully fetched ${allArticles.length} articles`);
    return allArticles;
  } catch (err) {
    console.error('[PubMed] Error:', err.message);
    return [];
  }
}

/**
 * Parse PubMed XML response into normalized objects
 */
function parsePubMedXML(xmlString) {
  const articles = [];

  try {
    // Extract article sections using regex (lightweight, no XML parser dep)
    const articleMatches = xmlString.match(/<PubmedArticle>[\s\S]*?<\/PubmedArticle>/g) || [];

    for (const articleXml of articleMatches) {
      const title = extractTag(articleXml, 'ArticleTitle') || 'Untitled';
      const abstract = extractAbstract(articleXml);
      const pmid = extractTag(articleXml, 'PMID') || '';
      const year = extractYear(articleXml);
      const authors = extractAuthors(articleXml);
      const journal = extractTag(articleXml, 'Title') || extractTag(articleXml, 'ISOAbbreviation') || 'PubMed Journal';

      articles.push({
        title: cleanText(title),
        abstract: cleanText(abstract) || 'No abstract available.',
        authors,
        year,
        source: journal,
        url: pmid ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` : '',
        sourceType: 'pubmed',
        pmid,
      });
    }
  } catch (err) {
    console.error('[PubMed] XML parse error:', err.message);
  }

  return articles;
}

function extractTag(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`, 'i'));
  return match ? match[1].trim() : null;
}

function extractAbstract(xml) {
  // AbstractText can be multiple sections
  const matches = xml.match(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/gi) || [];
  return matches.map(m => m.replace(/<[^>]+>/g, '').trim()).join(' ');
}

function extractYear(xml) {
  const pub = xml.match(/<PubDate>[\s\S]*?<Year>(\d{4})<\/Year>[\s\S]*?<\/PubDate>/i);
  if (pub) return parseInt(pub[1]);
  const any = xml.match(/<Year>(\d{4})<\/Year>/i);
  return any ? parseInt(any[1]) : new Date().getFullYear();
}

function extractAuthors(xml) {
  const matches = xml.match(/<LastName>([\s\S]*?)<\/LastName>/gi) || [];
  const lastNames = matches.slice(0, 5).map(m => m.replace(/<[^>]+>/g, '').trim());
  if (lastNames.length > 3) {
    return lastNames.slice(0, 3).join(', ') + ' et al.';
  }
  return lastNames.join(', ') || 'Unknown Authors';
}

function cleanText(text) {
  if (!text) return '';
  return text.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { fetchPubMedArticles };
