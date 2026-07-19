const { parseAndValidateRoster } = require('../services/importService');

const header = 'full_name,department_name,subject_name,grade_level,years_experience,ai_tool_usage_frequency,digital_skills_score,training_hours,last_assessment_date';

test('roster preview accepts a complete row and normalizes an optional assessment date', () => {
  const report = parseAndValidateRoster(Buffer.from(`${header}\nA Teacher,Sciences,Mathematics,Form 3,8,sometimes,64,12,2026-07-01`), 'roster.csv');

  expect(report.errors).toHaveLength(0);
  expect(report.valid).toHaveLength(1);
  expect(report.valid[0].value).toMatchObject({
    full_name: 'A Teacher',
    department_name: 'Sciences',
    subject_name: 'Mathematics',
    last_assessed_at: '2026-07-01T00:00:00.000Z',
  });
});

test('roster preview rejects ambiguous subject or department rows instead of assigning a fallback department', () => {
  const subjectOnly = parseAndValidateRoster(Buffer.from(`${header}\nA Teacher,,Mathematics,Form 3,8,sometimes,64,12,`), 'roster.csv');
  const departmentOnly = parseAndValidateRoster(Buffer.from(`${header}\nA Teacher,Sciences,,Form 3,8,sometimes,64,12,`), 'roster.csv');

  expect(subjectOnly.errors[0].errors).toContain('department_name is required when subject_name is provided');
  expect(departmentOnly.errors[0].errors).toContain('subject_name is required when department_name is provided');
});

test('roster preview surfaces unsupported columns as a warning rather than silently discarding them', () => {
  const report = parseAndValidateRoster(Buffer.from(`${header},private_note\nA Teacher,Sciences,Mathematics,Form 3,8,sometimes,64,12,,do not import`), 'roster.csv');

  expect(report.warnings).toEqual([{
    code: 'UNRECOGNIZED_COLUMNS',
    message: 'These columns will not be imported: private_note.',
  }]);
});
