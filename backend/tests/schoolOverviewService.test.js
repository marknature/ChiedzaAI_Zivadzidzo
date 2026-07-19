const {
  buildSchoolOverview,
  buildMinistrySchoolOverview,
  buildSchoolStructure,
  calculateTeacherDigitalReadiness,
} = require('../services/supabaseService');

const NOW = new Date('2026-07-19T12:00:00.000Z');
const institution = { id: 'school-1', name: 'Mbare Secondary', district: 'Harare', school_type: 'secondary' };

const teachers = [
  {
    id: 'teacher-1',
    full_name: 'Sensitive Teacher Name',
    subject_id: 'subject-1',
    digital_skills_score: 20,
    training_hours: 0,
    ai_tool_usage_frequency: 'never',
    last_assessed_at: '2026-07-10T12:00:00.000Z',
  },
  {
    id: 'teacher-2',
    full_name: 'Another Sensitive Name',
    subject_id: 'subject-1',
    digital_skills_score: 80,
    training_hours: 40,
    ai_tool_usage_frequency: 'daily',
    last_assessed_at: null,
  },
  {
    id: 'teacher-3',
    full_name: 'Unassessed Sensitive Name',
    subject_id: null,
    digital_skills_score: null,
    training_hours: null,
    ai_tool_usage_frequency: null,
    last_assessed_at: null,
  },
];

const predictions = [
  {
    task_type: 'teacher_roles', target_ref_id: 'teacher-1', created_at: '2026-07-01T10:00:00.000Z',
    input_features: { raw: { full_name: 'Sensitive Teacher Name' } },
    prediction: { exposure_band: 'high', reskilling_priority: 'high' }, confidence: 0.7,
  },
  {
    task_type: 'teacher_roles', target_ref_id: 'teacher-1', created_at: '2026-07-18T10:00:00.000Z',
    input_features: { raw: { full_name: 'Sensitive Teacher Name' } },
    prediction: { exposure_band: 'low', reskilling_priority: 'low' }, confidence: 0.8,
  },
  {
    task_type: 'teacher_roles', target_ref_id: 'teacher-2', created_at: '2026-07-17T10:00:00.000Z',
    input_features: { raw: { full_name: 'Another Sensitive Name' } },
    prediction: { exposure_band: 'critical', reskilling_priority: 'urgent' }, confidence: 0.9,
  },
  {
    task_type: 'teacher_roles', target_ref_id: 'outside-this-roster', created_at: '2026-07-18T10:00:00.000Z',
    prediction: { exposure_band: 'critical', reskilling_priority: 'urgent' }, confidence: 0.9,
  },
  {
    task_type: 'curriculum_skills', target_ref_id: null, created_at: '2026-07-10T10:00:00.000Z',
    input_features: { raw: { syllabusText: 'Confidential curriculum source text' } },
    prediction: { curriculum_readiness_score: 24, readiness_band: 'high_obsolescence', future_skills_score: 30 }, confidence: 0.74,
  },
  {
    task_type: 'curriculum_skills', target_ref_id: null, created_at: '2026-07-18T11:00:00.000Z',
    input_features: { raw: { syllabusText: 'More confidential curriculum source text' } },
    prediction: { curriculum_readiness_score: 75, readiness_band: 'ai_ready', future_skills_score: 71 }, confidence: 0.81,
  },
  {
    task_type: 'learning_outcomes', target_ref_id: null, created_at: '2026-07-11T10:00:00.000Z',
    input_features: { raw: { subjectName: 'Mathematics', historicalPassRates: [{ period: 'Term 1', passRatePercent: 42 }] } },
    prediction: { pass_rate_resilience_score: 42, trajectory_band: 'at_risk' }, confidence: 0.67,
  },
  {
    task_type: 'learning_outcomes', target_ref_id: null, created_at: '2026-07-18T11:00:00.000Z',
    input_features: { raw: { subjectName: 'English', historicalPassRates: [{ period: 'Term 1', passRatePercent: 72 }] } },
    prediction: { pass_rate_resilience_score: 72, trajectory_band: 'improving' }, confidence: 0.73,
  },
  {
    task_type: 'learning_outcomes', target_ref_id: null, created_at: '2026-06-01T11:00:00.000Z',
    prediction: { pass_rate_resilience_score: 10, trajectory_band: 'declining' }, confidence: 0.5,
  },
];

test('digital-readiness mapper uses the documented aggregate formula and skips incomplete records', () => {
  expect(calculateTeacherDigitalReadiness(teachers[0])).toBe(10);
  expect(calculateTeacherDigitalReadiness(teachers[1])).toBe(84);
  expect(calculateTeacherDigitalReadiness(teachers[2])).toBeNull();
});

test('school overview maps raw institution rows to an aggregate-only dashboard contract', () => {
  const overview = buildSchoolOverview({ institution, teachers, predictions, now: NOW });

  expect(overview.dataScope).toBe('institution_aggregate');
  expect(overview.institution).toEqual({ id: 'school-1', name: 'Mbare Secondary', district: 'Harare', schoolType: 'secondary' });
  expect(overview.schoolReadiness).toMatchObject({
    totalTeachers: 3,
    assessedTeachers: 2,
    averageDigitalReadiness: 47,
    highPriorityReskillingCount: 1,
    curriculumRiskCount: 1,
    recentActivityCount: 8,
  });
  expect(overview.teacherRoleRiskDistribution).toEqual({
    low: 1,
    moderate: 0,
    high: 0,
    critical: 1,
    assessedTeachers: 2,
    unassessedTeachers: 1,
  });
  expect(overview.latestCurriculumReadiness).toMatchObject({
    available: true,
    readinessScore: 75,
    readinessBand: 'ai_ready',
    futureSkillsScore: 71,
  });
  expect(overview.learningOutcomesTrend).toMatchObject({
    assessmentCount: 3,
    averageResilienceScore: 41.3,
    atRiskCount: 2,
    trajectoryDistribution: { declining: 1, at_risk: 1, stable: 0, improving: 1 },
  });
  expect(overview.priorityAlerts.map((alert) => alert.type)).toEqual(expect.arrayContaining([
    'teacher_reskilling', 'curriculum_risk', 'learning_outcomes', 'assessment_coverage',
  ]));

  const serialized = JSON.stringify(overview);
  expect(serialized).not.toContain('Sensitive Teacher Name');
  expect(serialized).not.toContain('Confidential curriculum source text');
  expect(serialized).not.toContain('input_features');
  expect(serialized).not.toContain('subjectName');
});

test('ministry overview is limited to aggregate-view fields and never restores raw insight detail', () => {
  const overview = buildMinistrySchoolOverview({
    institution,
    now: NOW,
    aggregateRows: [
      { task_type: 'teacher_roles', n_predictions: 5, avg_confidence: 0.6, month: '2026-07-01T00:00:00.000Z', raw_teacher_name: 'Do not expose' },
      { task_type: 'curriculum_skills', n_predictions: 2, avg_confidence: 0.75, month: '2026-07-01T00:00:00.000Z', input_features: { raw: 'Do not expose' } },
      { task_type: 'learning_outcomes', n_predictions: 3, avg_confidence: 0.8, month: '2026-07-01T00:00:00.000Z' },
      { task_type: 'teacher_roles', n_predictions: 8, avg_confidence: 0.5, month: '2026-06-01T00:00:00.000Z' },
    ],
  });

  expect(overview.dataScope).toBe('institution_aggregate_only');
  expect(overview.schoolReadiness).toMatchObject({ totalTeachers: null, assessedTeachers: null, recentActivityCount: 10 });
  expect(overview.priorityAlerts).toEqual([]);
  expect(overview.teacherRoleRiskDistribution.low).toBeNull();
  expect(overview.latestCurriculumReadiness).toEqual(expect.objectContaining({ available: true, assessmentCount: 2, averageConfidence: 0.75 }));
  expect(overview.learningOutcomesTrend).toEqual(expect.objectContaining({ assessmentCount: 3, averageConfidence: 0.8, trajectoryDistribution: null }));

  const serialized = JSON.stringify(overview);
  expect(serialized).not.toContain('Do not expose');
  expect(serialized).not.toContain('input_features');
  expect(serialized).not.toContain('raw_teacher_name');
});

test('school structure preserves department and subject navigation while adding aggregate staff metrics', () => {
  const structure = buildSchoolStructure({
    departments: [{ id: 'department-1', name: 'Sciences' }, { id: 'department-2', name: 'Languages' }],
    subjects: [{ id: 'subject-1', department_id: 'department-1', name: 'Mathematics', grade_level: 'Form 3' }],
    teachers,
    predictions,
  });

  expect(structure.departments[0]).toMatchObject({
    id: 'department-1',
    name: 'Sciences',
    subjects: [{ id: 'subject-1', name: 'Mathematics', grade_level: 'Form 3' }],
    metrics: { subjectCount: 1, staffCount: 2, assessedStaffCount: 2, highPriorityReskillingCount: 1 },
  });
  expect(structure.departments[1].metrics).toMatchObject({ subjectCount: 0, staffCount: 0, assessedStaffCount: 0 });
  expect(structure.staffSummary).toMatchObject({ totalTeachers: 3, assignedTeachers: 2, unassignedTeachers: 1, assessedTeachers: 2 });
  expect(JSON.stringify(structure)).not.toContain('Sensitive Teacher Name');
});
