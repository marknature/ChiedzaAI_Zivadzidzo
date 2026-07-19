const {
  buildTeacherRolesUserContent,
  validateLearningOutcomesInput,
} = require('../services/predictionService');
const {
  validateCurriculumSkillsInput,
  buildCurriculumUserContent,
} = require('../services/curriculumService');
const { toolDefinitions } = require('../services/chatTools');
const { assertLeadershipInsightAccess } = require('../services/chatTools');

test('Teacher Roles prompt includes role context but excludes teacher identifiers', () => {
  const prompt = buildTeacherRolesUserContent({
    subjectName: 'Mathematics',
    teacher: {
      full_name: 'Sensitive Teacher Name',
      id: '0b19e775-9271-4efc-9a8c-b4dcd521c78f',
      subject_id: 'c0edb301-3f49-4ee0-bc4f-79d6fc31fe38',
      last_assessed_at: '2026-07-18T12:00:00.000Z',
      years_experience: 7,
      digital_skills_score: 64,
      ai_tool_usage_frequency: 'sometimes',
      training_hours: 15,
    },
  });

  expect(prompt).toContain('Subject: Mathematics');
  expect(prompt).toContain('Last assessment date: 2026-07-18');
  expect(prompt).not.toContain('Sensitive Teacher Name');
  expect(prompt).not.toContain('0b19e775-9271-4efc-9a8c-b4dcd521c78f');
  expect(prompt).not.toContain('c0edb301-3f49-4ee0-bc4f-79d6fc31fe38');
});

test('Curriculum Skills validates and deterministically renders optional subject/topic context', () => {
  const input = validateCurriculumSkillsInput({
    title: 'Form 3 STEM',
    gradeLevel: 'Form 3',
    syllabusText: 'Learners explore data, systems thinking, and practical robotics projects.',
    alpha: 0.8,
    subjectTopicBreakdown: [{ subject: 'Computing', topics: ['Data literacy', 'Robotics'] }],
  });
  const prompt = buildCurriculumUserContent(input);

  expect(input.subjectTopicBreakdown).toEqual([{ subject: 'Computing', topics: ['Data literacy', 'Robotics'] }]);
  expect(prompt).toContain('- Computing: Data literacy; Robotics');
  expect(buildCurriculumUserContent({ ...input, subjectTopicBreakdown: [] }))
    .toContain('No structured subject/topic breakdown was supplied; use only the syllabus.');
});

test('Curriculum Skills rejects malformed or oversized structured context rather than silently truncating it', () => {
  const common = {
    syllabusText: 'A sufficiently detailed syllabus describing applied learning and future-ready skills.',
  };
  expect(() => validateCurriculumSkillsInput({ ...common, subjectTopicBreakdown: [{ subject: 'Computing', topics: ['Data'], extra: true }] }))
    .toThrow(/only subject and topics/i);
  expect(() => validateCurriculumSkillsInput({ ...common, subjectTopicBreakdown: [{ subject: 'Computing', topics: ['x'.repeat(161)] }] }))
    .toThrow(/160 characters or fewer/i);
  expect(() => validateCurriculumSkillsInput({ ...common, alpha: '0.8' }))
    .toThrow(/number between 0 and 1/i);
});

test('Learning Outcomes rejects identifiers embedded in aggregate delivery context', () => {
  expect(() => validateLearningOutcomesInput({
    subjectName: 'Mathematics',
    historicalPassRates: [{ period: 'Term 1', passRatePercent: 64 }],
    aiToolExposureLevel: 40,
    curriculumDeliveryContext: 'Candidate number: C-001 received a special intervention.',
  })).toThrow(/learner identifiers/i);
});

test('Chat tool contracts expose only strict aggregate contexts', () => {
  const learning = toolDefinitions.find((tool) => tool.function.name === 'run_learning_outcome_prediction').function.parameters;
  const curriculum = toolDefinitions.find((tool) => tool.function.name === 'run_curriculum_prediction').function.parameters;

  expect(learning.additionalProperties).toBe(false);
  expect(learning.properties.historicalPassRates.items.additionalProperties).toBe(false);
  expect(curriculum.additionalProperties).toBe(false);
  expect(curriculum.properties.subjectTopicBreakdown.items.additionalProperties).toBe(false);
  expect(curriculum.properties.subjectTopicBreakdown.items.required).toEqual(['subject', 'topics']);
});

test('chat data tools cannot bypass assessment role gates', () => {
  expect(() => assertLeadershipInsightAccess({ role: 'teacher' })).toThrow(/administrators and head teachers/i);
  expect(() => assertLeadershipInsightAccess({ role: 'head_teacher' })).not.toThrow();
});
