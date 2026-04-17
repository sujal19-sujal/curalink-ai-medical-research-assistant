import React from 'react';

/**
 * Render markdown-like text from LLM response to styled HTML
 * Handles ## headers, bullets, bold, blockquotes
 */
function renderMarkdown(text) {
  if (!text) return null;

  const lines = text.split('\n');
  const elements = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // H2 headers (##)
    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={i}>{line.replace(/^## /, '').replace(/[🔬📚🏥🔗📝]/u, '').trim()
          .replace(/^(🔬|📚|🏥|🔗|📝)\s*/u, '')}</h2>
      );
      i++;
      continue;
    }

    // Blockquotes
    if (line.startsWith('> ')) {
      elements.push(
        <blockquote key={i}>{parseBold(line.replace(/^> /, ''))}</blockquote>
      );
      i++;
      continue;
    }

    // Bullet points (• or - or *)
    if (line.match(/^[•\-\*]\s/)) {
      const bullets = [];
      while (i < lines.length && lines[i].match(/^[•\-\*]\s/)) {
        bullets.push(<li key={i}>{parseBold(lines[i].replace(/^[•\-\*]\s/, ''))}</li>);
        i++;
      }
      elements.push(<ul key={`ul-${i}`}>{bullets}</ul>);
      continue;
    }

    // Numbered lists
    if (line.match(/^\d+\.\s/)) {
      const items = [];
      while (i < lines.length && lines[i].match(/^\d+\.\s/)) {
        items.push(<li key={i}>{parseBold(lines[i].replace(/^\d+\.\s/, ''))}</li>);
        i++;
      }
      elements.push(<ol key={`ol-${i}`}>{items}</ol>);
      continue;
    }

    // Empty lines
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Regular paragraph
    elements.push(<p key={i}>{parseBold(line)}</p>);
    i++;
  }

  return elements;
}

function parseBold(text) {
  if (!text || !text.includes('**')) return text;
  const parts = text.split(/\*\*([^*]+)\*\*/);
  return parts.map((part, idx) =>
    idx % 2 === 1 ? <strong key={idx}>{part}</strong> : part
  );
}

export default function MarkdownRenderer({ content }) {
  return (
    <div className="markdown-content">
      {renderMarkdown(content)}
    </div>
  );
}
