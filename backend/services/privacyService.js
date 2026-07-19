// Privacy boundary for inputs that may describe learning outcomes. ZivaDzidzo
// accepts only cohort aggregates: student/learner identifiers must be rejected
// before text is sent to OpenAI or persisted to Supabase.

const LEARNER_IDENTIFIER_KEYS = new Set([
  'studentid', 'studentname', 'studentnumber', 'studentemail',
  'learnerid', 'learnername', 'learnernumber', 'learneremail',
  'pupilid', 'pupilname', 'pupilnumber', 'pupilemail',
  'nationalid', 'nationalidentitynumber', 'registrationnumber',
  'admissionnumber', 'candidateid', 'candidatenumber',
]);

function normaliseKey(key) {
  return String(key || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findLearnerIdentifierFields(value, path = '$') {
  if (value === null || value === undefined) return [];
  if (typeof value === 'string') {
    const violations = [];
    if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(value)) violations.push(`${path} contains an email address`);
    if (/\b(?:student|learner|pupil|candidate)\s*(?:name|id|number|email|national\s*id|registration|admission)\s*[:=#-]\s*\S+/i.test(value)
      || /\b(?:national\s*(?:id|identity\s*number)|admission\s*number|candidate\s*(?:id|number))\s*[:=#-]\s*\S+/i.test(value)) {
      violations.push(`${path} contains a learner identifier`);
    }
    return violations;
  }
  if (typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap((item, index) => findLearnerIdentifierFields(item, `${path}[${index}]`));

  return Object.entries(value).flatMap(([key, nested]) => {
    const keyPath = `${path}.${key}`;
    const keyViolation = LEARNER_IDENTIFIER_KEYS.has(normaliseKey(key)) ? [keyPath] : [];
    return [...keyViolation, ...findLearnerIdentifierFields(nested, keyPath)];
  });
}

function rejectLearnerIdentifiers(value) {
  const violations = findLearnerIdentifierFields(value);
  if (!violations.length) return;
  const error = new Error(`ZivaDzidzo accepts aggregate learning data only. Remove learner identifiers: ${violations.join(', ')}.`);
  error.code = 'VALIDATION';
  throw error;
}

module.exports = { findLearnerIdentifierFields, normaliseKey, rejectLearnerIdentifiers };
