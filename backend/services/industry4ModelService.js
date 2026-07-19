const fs = require('fs');
const path = require('path');

const ARTIFACT_PATH = path.resolve(__dirname, '..', 'models', 'industry4_numpy_model.json');
let artifactCache;

function modelUnavailable() {
  const error = new Error('The Industry 4.0 model artifact has not been trained yet. Run backend/notebooks/train_numpy_portfolio.py.');
  error.code = 'MODEL_UNAVAILABLE';
  return error;
}

function loadArtifact() {
  if (artifactCache) return artifactCache;
  if (!fs.existsSync(ARTIFACT_PATH)) throw modelUnavailable();
  artifactCache = JSON.parse(fs.readFileSync(ARTIFACT_PATH, 'utf8'));
  return artifactCache;
}

function normalise(features, artifact) {
  return artifact.features.map((name, index) => {
    const value = Number(features?.[name]);
    if (!Number.isFinite(value)) {
      const error = new Error(`cohortFeatures.${name} must be a finite number.`);
      error.code = 'VALIDATION';
      throw error;
    }
    return (value - artifact.normalization.mean[index]) / artifact.normalization.scale[index];
  });
}

function predictReadiness(normalised, artifact) {
  const classification = artifact.classification;
  if (classification.selected === 'nearest_centroid') {
    const distances = classification.centroids.map((centroid) => centroid.reduce((sum, value, index) => sum + ((normalised[index] - value) ** 2), 0));
    return classification.classes[distances.indexOf(Math.min(...distances))];
  }
  if (classification.selected === 'softmax_regression') {
    const scores = classification.classes.map((_, classIndex) => classification.softmax_bias[classIndex] + normalised.reduce((sum, value, featureIndex) => sum + value * classification.softmax_weights[featureIndex][classIndex], 0));
    return classification.classes[scores.indexOf(Math.max(...scores))];
  }
  return classification.majority_label;
}

function predictSkillGap(normalised, artifact) {
  const regression = artifact.regression;
  if (regression.selected === 'linear_regression' || regression.selected === 'ridge_regression') {
    const coefficients = regression.selected === 'linear_regression' ? regression.linear_coefficients : regression.ridge_coefficients;
    return coefficients[0] + normalised.reduce((sum, value, index) => sum + value * coefficients[index + 1], 0);
  }
  return regression.mean;
}

function predictIndustry4Cohort(cohortFeatures) {
  const artifact = loadArtifact();
  const normalised = normalise(cohortFeatures, artifact);
  const deviations = artifact.features.map((feature, index) => ({ feature, deviation: Math.abs(normalised[index]), value: Number(cohortFeatures[feature]) }))
    .sort((a, b) => b.deviation - a.deviation)
    .slice(0, 3);
  return {
    modelVersion: artifact.version,
    readinessLevel: predictReadiness(normalised, artifact),
    predictedSkillGapScore: Number(Math.max(0, Math.min(100, predictSkillGap(normalised, artifact))).toFixed(2)),
    contributingSignals: deviations.map(({ feature, value }) => ({ feature, value, explanation: 'This cohort average differs most from the Industry 4.0 training distribution.' })),
    caveat: 'This benchmark is trained on an external Industry 4.0 vocational dataset. It supports aggregate curriculum planning only; it is not a judgement or prediction about an individual learner, teacher, or Zimbabwean school.'
  };
}

function getIndustry4ModelStatus() {
  const artifact = loadArtifact();
  return {
    available: true,
    modelVersion: artifact.version,
    trainedRows: artifact.rows,
    readinessModel: artifact.classification.selected,
    readinessMetrics: artifact.classification.metrics[artifact.classification.selected],
    skillGapModel: artifact.regression.selected,
    skillGapMetrics: artifact.regression.metrics[artifact.regression.selected],
    privacyScope: artifact.privacy_scope,
  };
}

module.exports = { getIndustry4ModelStatus, predictIndustry4Cohort, loadArtifact };
