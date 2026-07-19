const { parse } = require('csv-parse/sync');
const XLSX = require('xlsx');

const REQUIRED_COLUMNS = ['full_name'];
const OPTIONAL_COLUMNS = ['subject_name', 'department_name', 'grade_level', 'years_experience', 'ai_tool_usage_frequency', 'digital_skills_score', 'training_hours', 'last_assessment_date'];
const ACCEPTED_COLUMNS = [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS];
const FREQUENCIES = new Set(['never', 'rarely', 'sometimes', 'often', 'daily']);

function normalizeRow(source) {
  return Object.fromEntries(Object.entries(source).map(([key, value]) => [key.trim().toLowerCase(), typeof value === 'string' ? value.trim() : value]));
}

function readRows(buffer, originalName) {
  const name = (originalName || '').toLowerCase();
  if (name.endsWith('.csv')) return parse(buffer, { columns: true, skip_empty_lines: true, trim: true });
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const book = XLSX.read(buffer, { type: 'buffer' });
    const firstSheet = book.Sheets[book.SheetNames[0]];
    return XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
  }
  throw new Error('Upload a CSV, XLS, or XLSX file.');
}

function numeric(value, field, errors) {
  if (value === '' || value === undefined || value === null) return null;
  const number = Number(value);
  if (!Number.isFinite(number)) errors.push(`${field} must be a number`);
  return Number.isFinite(number) ? number : null;
}

function timestamp(value, field, errors) {
  if (value === '' || value === undefined || value === null) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    errors.push(`${field} must be a valid date or ISO timestamp`);
    return null;
  }
  return parsed.toISOString();
}

function validateRosterRow(raw, index) {
  const row = normalizeRow(raw);
  const errors = [];
  if (!row.full_name) errors.push('full_name is required');
  const yearsExperience = numeric(row.years_experience, 'years_experience', errors);
  const digitalSkillsScore = numeric(row.digital_skills_score, 'digital_skills_score', errors);
  const trainingHours = numeric(row.training_hours, 'training_hours', errors);
  const lastAssessedAt = timestamp(row.last_assessment_date, 'last_assessment_date', errors);
  if (yearsExperience !== null && yearsExperience < 0) errors.push('years_experience cannot be negative');
  if (digitalSkillsScore !== null && (digitalSkillsScore < 0 || digitalSkillsScore > 100)) errors.push('digital_skills_score must be between 0 and 100');
  if (trainingHours !== null && trainingHours < 0) errors.push('training_hours cannot be negative');
  const frequency = row.ai_tool_usage_frequency ? String(row.ai_tool_usage_frequency).toLowerCase() : null;
  if (frequency && !FREQUENCIES.has(frequency)) errors.push('ai_tool_usage_frequency must be never, rarely, sometimes, often, or daily');
  if (row.subject_name && !row.department_name) errors.push('department_name is required when subject_name is provided');
  if (row.department_name && !row.subject_name) errors.push('subject_name is required when department_name is provided');
  return {
    row: index + 2,
    errors,
    value: {
      full_name: row.full_name,
      subject_name: row.subject_name || null,
      department_name: row.department_name || null,
      grade_level: row.grade_level || null,
      years_experience: yearsExperience,
      ai_tool_usage_frequency: frequency,
      digital_skills_score: digitalSkillsScore,
      training_hours: trainingHours,
      last_assessed_at: lastAssessedAt,
    },
  };
}

function parseAndValidateRoster(buffer, originalName) {
  const rows = readRows(buffer, originalName);
  if (!rows.length) throw new Error('The uploaded file has no data rows.');
  const validated = rows.map(validateRosterRow);
  const sourceColumns = [...new Set(rows.flatMap((row) => Object.keys(row).map((key) => String(key).trim().toLowerCase())))];
  const unexpectedColumns = sourceColumns.filter((column) => !ACCEPTED_COLUMNS.includes(column));
  const warnings = unexpectedColumns.length
    ? [{ code: 'UNRECOGNIZED_COLUMNS', message: `These columns will not be imported: ${unexpectedColumns.join(', ')}.` }]
    : [];
  return {
    valid: validated.filter((item) => item.errors.length === 0),
    errors: validated.filter((item) => item.errors.length > 0),
    warnings,
    acceptedColumns: ACCEPTED_COLUMNS,
  };
}

module.exports = { parseAndValidateRoster, validateRosterRow, ACCEPTED_COLUMNS };
