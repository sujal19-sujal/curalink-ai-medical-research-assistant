import React from 'react';

const SOURCE_LABELS = {
  pubmed: 'PubMed',
  openalex: 'OpenAlex',
};

const SOURCE_CLASS = {
  pubmed: 'pub-source-pubmed',
  openalex: 'pub-source-openalex',
};

export default function PublicationCard({ pub, index }) {
  const sourceLabel = SOURCE_LABELS[pub.sourceType] || pub.sourceType || 'Research';
  const sourceClass = SOURCE_CLASS[pub.sourceType] || 'pub-source-openalex';

  return (
    <div className="pub-card animate-in" style={{ animationDelay: `${index * 60}ms` }}>
      <span className={`pub-source-badge ${sourceClass}`}>{sourceLabel}</span>

      <div className="pub-title" title={pub.title}>
        {pub.title}
      </div>

      <div className="pub-authors">👤 {pub.authors}</div>
      <div className="pub-year-source">
        📅 {pub.year} &nbsp;•&nbsp; 📰 {pub.source}
      </div>

      {pub.abstract && pub.abstract !== 'No abstract available.' && (
        <div className="pub-abstract">{pub.abstract}</div>
      )}

      {pub.url && (
        <a
          href={pub.url}
          target="_blank"
          rel="noopener noreferrer"
          className="pub-link"
        >
          🔗 View Full Paper ↗
        </a>
      )}
    </div>
  );
}
