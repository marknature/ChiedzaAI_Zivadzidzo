const fs = require('fs');
const path = require('path');

const FUSION_ARTIFACT_PATH = path.resolve(__dirname, '..', 'models', 'industry4_neural_fusion_model.json');
const BASELINE_ARTIFACT_PATH = path.resolve(__dirname, '..', 'models', 'industry4_numpy_model.json');
let artifactCache;

function modelUnavailable() {
  const error = new Error('The Industry 4.0 model artifact has not been trained yet. Run backend/notebooks/train_numpy_portfolio.py.');
  error.code = 'MODEL_UNAVAILABLE';
  return error;
}

function loadArtifact() {
  if (artifactCache) return artifactCache;
  const artifactPath = fs.existsSync(FUSION_ARTIFACT_PATH) ? FUSION_ARTIFACT_PATH : BASELINE_ARTIFACT_PATH;
  if (!fs.existsSync(artifactPath)) throw modelUnavailable();
  artifactCache = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  return artifactCache;
}

function softmax(scores) {
  const highest = Math.max(...scores);
  const exponentials = scores.map((score) => Math.exp(score - highest));
  const total = exponentials.reduce((sum, value) => sum + value, 0);
  return exponentials.map((value) => value / total);
}

function relu(values) {
  return values.map((value) => Math.max(0, value));
}

function dense(values, weights, bias) {
  return bias.map((offset, outputIndex) => offset + values.reduce((sum, value, inputIndex) => sum + value * weights[inputIndex][outputIndex], 0));
}

function neuralOutputs(normalised, neural) {
  // The fusion artifact uses one shared two-layer trunk and two task heads.
  if (!neural?.class_w || !neural?.reg_w) return null;
  const hiddenOne = relu(dense(normalised, neural.w1, neural.b1));
  const sharedTrunk = relu(dense(hiddenOne, neural.w2, neural.b2));
  const readinessProbabilities = softmax(dense(sharedTrunk, neural.class_w, neural.class_b));
  const normalisedGap = dense(sharedTrunk, neural.reg_w, neural.reg_b)[0];
  return { readinessProbabilities, skillGap: normalisedGap * neural.target_scale + neural.target_mean };
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
  const centroidProbabilities = () => {
    const distances = classification.centroids.map((centroid) => centroid.reduce((sum, value, index) => sum + ((normalised[index] - value) ** 2), 0));
    return softmax(distances.map((distance) => -distance));
  };
  const softmaxProbabilities = () => softmax(classification.classes.map((_, classIndex) => classification.softmax_bias[classIndex] + normalised.reduce((sum, value, featureIndex) => sum + value * classification.softmax_weights[featureIndex][classIndex], 0)));
  const neural = neuralOutputs(normalised, classification.neural);
  if (classification.selected === 'weighted_fusion' && classification.fusion_weights && neural) {
    const componentProbabilities = { nearest_centroid: centroidProbabilities(), softmax_regression: softmaxProbabilities(), neural_mlp: neural.readinessProbabilities };
    const fused = classification.classes.map((_, classIndex) => Object.entries(classification.fusion_weights).reduce((sum, [modelName, weight]) => sum + weight * componentProbabilities[modelName][classIndex], 0));
    return classification.classes[fused.indexOf(Math.max(...fused))];
  }
  if (classification.selected === 'neural_mlp' && neural) {
    return classification.classes[neural.readinessProbabilities.indexOf(Math.max(...neural.readinessProbabilities))];
  }
  if (classification.selected === 'nearest_centroid') {
    const probabilities = centroidProbabilities();
    return classification.classes[probabilities.indexOf(Math.max(...probabilities))];
  }
  if (classification.selected === 'softmax_regression') {
    const probabilities = softmaxProbabilities();
    return classification.classes[probabilities.indexOf(Math.max(...probabilities))];
  }
  return classification.majority_label;
}

function predictSkillGap(normalised, artifact) {
  const regression = artifact.regression;
  const linear = () => regression.linear_coefficients[0] + normalised.reduce((sum, value, index) => sum + value * regression.linear_coefficients[index + 1], 0);
  const neural = neuralOutputs(normalised, regression.neural);
  if (regression.selected === 'weighted_fusion' && regression.fusion_weights && neural) {
    const components = { mean_baseline: regression.mean, linear_regression: linear(), neural_mlp: neural.skillGap };
    return Object.entries(regression.fusion_weights).reduce((sum, [modelName, weight]) => sum + weight * components[modelName], 0);
  }
  if (regression.selected === 'neural_mlp' && neural) return neural.skillGap;
  if (regression.selected === 'linear_regression' || regression.selected === 'ridge_regression') {
    if (regression.selected === 'linear_regression') return linear();
    const coefficients = regression.ridge_coefficients;
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
