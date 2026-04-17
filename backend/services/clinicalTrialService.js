const axios = require('axios');
require('dotenv').config();

const BASE_URL = process.env.CLINICALTRIALS_BASE_URL;

/**
 * Fetch clinical trials from ClinicalTrials.gov API v2
 * @param {object} params - { condition, query, location }
 * @param {number} maxResults
 * @returns {Array} normalized clinical trials
 */
async function fetchClinicalTrials({ condition, query, location }, maxResults = 50) {
  try {
    console.log(`[ClinicalTrials] Searching condition: "${condition}", location: "${location}"`);

    const params = {
      format: 'json',
      pageSize: Math.min(maxResults, 100),
      'query.cond': condition || query,
      'query.term': query,
      fields: [
        'NCTId',
        'BriefTitle',
        'OfficialTitle',
        'OverallStatus',
        'StartDate',
        'CompletionDate',
        'Phase',
        'StudyType',
        'BriefSummary',
        'EligibilityCriteria',
        'LocationCountry',
        'LocationCity',
        'LocationFacility',
        'CentralContactName',
        'CentralContactPhone',
        'CentralContactEMail',
        'LeadSponsorName',
        'EnrollmentCount',
      ].join(','),
    };

    if (location) {
      params['query.locn'] = location;
    }

    const res = await axios.get(`${BASE_URL}/studies`, {
      params,
      timeout: 15000,
    });

    const studies = res.data?.studies || [];
    console.log(`[ClinicalTrials] Found ${studies.length} trials`);

    return studies.map(normalizeTrial);
  } catch (err) {
    console.error('[ClinicalTrials] Error:', err.message);
    return [];
  }
}

/**
 * Normalize a single trial object from CT.gov API v2
 */
function normalizeTrial(study) {
  const proto = study.protocolSection || {};
  const id = proto.identificationModule || {};
  const status = proto.statusModule || {};
  const desc = proto.descriptionModule || {};
  const eligibility = proto.eligibilityModule || {};
  const contacts = proto.contactsLocationsModule || {};
  const design = proto.designModule || {};
  const sponsor = proto.sponsorCollaboratorsModule || {};

  const nctId = id.nctId || '';
  const locations = contacts.locations || [];
  const centralContacts = contacts.centralContacts || [];

  const locationStr = locations
    .slice(0, 3)
    .map(l => [l.facility, l.city, l.country].filter(Boolean).join(', '))
    .join('; ') || 'Not specified';

  const contact = centralContacts[0]
    ? {
        name: centralContacts[0].name || '',
        phone: centralContacts[0].phone || '',
        email: centralContacts[0].email || '',
      }
    : { name: 'N/A', phone: '', email: '' };

  return {
    nctId,
    title: id.briefTitle || id.officialTitle || 'Untitled Trial',
    status: status.overallStatus || 'Unknown',
    phase: (design.phases || []).join(', ') || 'N/A',
    studyType: design.studyType || 'N/A',
    summary: desc.briefSummary || 'No summary available.',
    eligibility: eligibility.eligibilityCriteria || 'See trial page for details.',
    location: locationStr,
    contact,
    sponsor: sponsor.leadSponsor?.name || 'Unknown',
    enrollment: design.enrollmentInfo?.count || 'N/A',
    startDate: status.startDateStruct?.date || 'N/A',
    completionDate: status.completionDateStruct?.date || 'N/A',
    url: nctId ? `https://clinicaltrials.gov/study/${nctId}` : '',
    sourceType: 'clinicaltrial',
  };
}

module.exports = { fetchClinicalTrials };
