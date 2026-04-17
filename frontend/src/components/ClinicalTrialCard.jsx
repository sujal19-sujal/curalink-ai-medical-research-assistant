import React from 'react';

const STATUS_LABELS = {
  RECRUITING: 'Recruiting',
  COMPLETED: 'Completed',
  ACTIVE_NOT_RECRUITING: 'Active',
  SUSPENDED: 'Suspended',
  TERMINATED: 'Terminated',
  NOT_YET_RECRUITING: 'Not Yet Recruiting',
  WITHDRAWN: 'Withdrawn',
};

function getStatusClass(status) {
  if (!status) return 'status-default';
  if (STATUS_LABELS[status]) return `status-${status}`;
  return 'status-default';
}

export default function ClinicalTrialCard({ trial, index }) {
  const statusLabel = STATUS_LABELS[trial.status] || trial.status || 'Unknown';
  const statusClass = getStatusClass(trial.status);

  return (
    <div className="trial-card animate-in" style={{ animationDelay: `${index * 60}ms` }}>
      <div className="trial-header">
        <div className="trial-title">{trial.title}</div>
        <span className={`trial-status ${statusClass}`}>{statusLabel}</span>
      </div>

      <div className="trial-meta">
        {trial.phase && trial.phase !== 'N/A' && (
          <span className="badge badge-blue">Phase {trial.phase}</span>
        )}
        {trial.studyType && trial.studyType !== 'N/A' && (
          <span className="badge badge-amber">{trial.studyType}</span>
        )}
        {trial.enrollment && trial.enrollment !== 'N/A' && (
          <span className="badge badge-green">n={trial.enrollment}</span>
        )}
      </div>

      {trial.location && trial.location !== 'Not specified' && (
        <div className="trial-info">📍 {trial.location}</div>
      )}

      {trial.startDate && trial.startDate !== 'N/A' && (
        <div className="trial-info">
          📅 Start: {trial.startDate}
          {trial.completionDate && trial.completionDate !== 'N/A'
            ? ` → ${trial.completionDate}`
            : ''}
        </div>
      )}

      {trial.sponsor && (
        <div className="trial-info">🏛️ {trial.sponsor}</div>
      )}

      {trial.summary && trial.summary !== 'No summary available.' && (
        <div className="trial-summary">{trial.summary}</div>
      )}

      {trial.contact?.email && (
        <div className="trial-info" style={{ marginTop: 8 }}>
          ✉️ <a href={`mailto:${trial.contact.email}`} style={{ color: 'var(--accent-cyan)' }}>
            {trial.contact.name || trial.contact.email}
          </a>
        </div>
      )}

      {trial.url && (
        <a
          href={trial.url}
          target="_blank"
          rel="noopener noreferrer"
          className="pub-link"
          style={{ marginTop: 8 }}
        >
          🔗 View on ClinicalTrials.gov ↗
        </a>
      )}
    </div>
  );
}
