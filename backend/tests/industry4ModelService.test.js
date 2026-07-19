const { getIndustry4ModelStatus, predictIndustry4Cohort } = require('../services/industry4ModelService');

const representativeCohort = {
  Theory_Score: 80, Assignment_Score: 82, Internal_Exam_Score: 78, Attendance_Percentage: 85,
  LMS_Login_Count: 100, LMS_Time_Spent_Hours: 45, Lab_Task_Completion_Percentage: 83,
  Lab_Accuracy_Score: 81, Practical_Exam_Score: 82, Simulation_Score: 79,
  Troubleshooting_Score: 80, AI_Skill_Score: 75, IoT_Skill_Score: 74, Robotics_Skill_Score: 72,
  Data_Analytics_Score: 76, Automation_Skill_Score: 75, Problem_Solving_Score: 80,
  Teamwork_Score: 78, Communication_Score: 79,
};

test('Industry 4.0 artifact exposes real selected metrics', () => {
  const status = getIndustry4ModelStatus();
  expect(status.available).toBe(true);
  expect(status.trainedRows).toBe(15000);
  expect(status.readinessMetrics.macro_f1).toBeGreaterThan(0.9);
});

test('aggregate cohort prediction returns bounded, explainable output', () => {
  const insight = predictIndustry4Cohort(representativeCohort);
  expect(typeof insight.readinessLevel).toBe('string');
  expect(insight.predictedSkillGapScore).toBeGreaterThanOrEqual(0);
  expect(insight.predictedSkillGapScore).toBeLessThanOrEqual(100);
  expect(insight.contributingSignals).toHaveLength(3);
  expect(insight.caveat).toContain('aggregate curriculum planning');
});
