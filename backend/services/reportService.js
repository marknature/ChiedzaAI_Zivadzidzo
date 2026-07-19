const { Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun } = require('docx');
const PDFDocument = require('pdfkit');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const { supabaseAdmin } = require('../db');
const { OPENAI_MODELS } = require('../config');

const BUCKET = process.env.SUPABASE_REPORTS_BUCKET || 'reports';
const chartCanvas = new ChartJSNodeCanvas({ width: 800, height: 380, backgroundColour: '#ffffff' });

function safeText(value) { return value === null || value === undefined || value === '' ? 'Not available' : String(value); }

function displayTimestamp(value) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? 'Not available' : date.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');
}

function compactSummary({ title, score, band, factors, actions }) {
  const strongestFactor = factors[0]?.factor;
  const action = actions[0];
  const evidence = strongestFactor ? `The strongest contributing factor is ${strongestFactor}.` : 'The available evidence did not include a ranked contributing factor.';
  const nextStep = action ? `Priority next step: ${action}` : 'Review the contributing evidence with the relevant leadership team.';
  return `${title} received a score of ${score} (${band}). ${evidence} ${nextStep}`;
}

function reportContent(prediction, title, generatedAt = new Date().toISOString()) {
  const data = prediction.prediction || {};
  const rationale = prediction.rationale || {};
  const score = data.ai_disruption_exposure_score ?? data.pass_rate_resilience_score ?? data.curriculum_readiness_score ?? '—';
  const band = data.exposure_band ?? data.trajectory_band ?? data.readiness_band ?? '—';
  const actions = Array.isArray(data.recommended_actions) ? data.recommended_actions : [];
  const factors = Array.isArray(rationale.contributing_factors) ? rationale.contributing_factors : [];
  const content = {
    title,
    score,
    band,
    actions,
    factors,
    caveats: rationale.caveats || 'This is LLM-reasoned and associational decision support, not a causal or definitive assessment.',
    generatedAt,
    modelVersion: prediction.model_version || 'Not recorded',
  };
  return { ...content, executiveSummary: compactSummary(content) };
}

async function chartFor(content) {
  const weights = content.factors.slice(0, 5);
  return chartCanvas.renderToBuffer({ type: 'bar', data: { labels: weights.map((item) => item.factor), datasets: [{ label: 'Relative weight', data: weights.map((item) => item.relative_weight), backgroundColor: '#2FBF9F' }] }, options: { indexAxis: 'y', scales: { x: { min: 0, max: 1 } }, plugins: { legend: { display: false } } } });
}

async function buildDocx(content) {
  const chart = await chartFor(content);
  const factorParagraphs = content.factors.length
    ? content.factors.map((factor) => new Paragraph({ text: `${safeText(factor.factor)}: ${safeText(factor.evidence)} (${Math.round(Number(factor.relative_weight || 0) * 100)}%)`, bullet: { level: 0 } }))
    : [new Paragraph({ text: 'No ranked contributing factors were returned for this assessment.' })];
  const actionParagraphs = content.actions.length
    ? content.actions.map((action) => new Paragraph({ text: action, bullet: { level: 0 } }))
    : [new Paragraph({ text: 'No recommended next moves were returned for this assessment.' })];
  const children = [
    new Paragraph({ text: 'ZivaDzidzo decision-support report', heading: HeadingLevel.TITLE }),
    new Paragraph({ text: content.title, heading: HeadingLevel.HEADING_1 }),
    new Paragraph({ children: [new TextRun({ text: `Generated: ${displayTimestamp(content.generatedAt)}`, bold: true })] }),
    new Paragraph({ text: `Model / prompt version: ${safeText(content.modelVersion)}` }),
    new Paragraph({ text: 'Executive summary', heading: HeadingLevel.HEADING_2 }),
    new Paragraph({ text: content.executiveSummary }),
    new Paragraph({ children: [new TextRun({ text: `Score: ${content.score} (${content.band})`, bold: true })] }),
    new Paragraph({ text: 'What influenced this score', heading: HeadingLevel.HEADING_2 }),
    ...factorParagraphs,
    new Paragraph({ children: [new ImageRun({ data: chart, transformation: { width: 560, height: 266 }, type: 'png' })] }),
    new Paragraph({ text: 'Recommended next moves', heading: HeadingLevel.HEADING_2 }),
    ...actionParagraphs,
    new Paragraph({ text: 'Caveat', heading: HeadingLevel.HEADING_2 }),
    new Paragraph({ text: content.caveats }),
  ];
  return Packer.toBuffer(new Document({ sections: [{ children }] }));
}

async function buildPdf(content) {
  const chart = await chartFor(content);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.fontSize(20).text('ZivaDzidzo decision-support report');
    doc.moveDown(0.5).fontSize(15).text(content.title);
    doc.fontSize(10).fillColor('#475569').text(`Generated: ${displayTimestamp(content.generatedAt)}`);
    doc.text(`Model / prompt version: ${safeText(content.modelVersion)}`);
    doc.fillColor('#111827').moveDown().fontSize(14).text('Executive summary');
    doc.fontSize(11).text(content.executiveSummary);
    doc.moveDown(0.5).fontSize(12).text(`Score: ${content.score} (${content.band})`);
    doc.moveDown().fontSize(14).text('What influenced this score');
    if (content.factors.length) {
      content.factors.forEach((factor) => doc.fontSize(11).text(`• ${safeText(factor.factor)} — ${safeText(factor.evidence)} (${Math.round(Number(factor.relative_weight || 0) * 100)}%)`));
    } else {
      doc.fontSize(11).text('No ranked contributing factors were returned for this assessment.');
    }
    if (doc.y > 420) doc.addPage();
    doc.moveDown().image(chart, { fit: [500, 238], align: 'center' });
    doc.moveDown().fontSize(14).text('Recommended next moves');
    if (content.actions.length) content.actions.forEach((action) => doc.fontSize(11).text(`• ${action}`));
    else doc.fontSize(11).text('No recommended next moves were returned for this assessment.');
    doc.moveDown().fontSize(14).text('Caveat');
    doc.fontSize(11).text(content.caveats);
    doc.end();
  });
}

async function uploadAndSign({ institutionId, createdBy, reportType, baseName, buffer, extension, client }) {
  const storagePath = `reports/${institutionId}/${baseName}.${extension}`;
  const { error: uploadError } = await supabaseAdmin.storage.from(BUCKET).upload(storagePath, buffer, { contentType: extension === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', upsert: false });
  if (uploadError) throw new Error(`Could not upload report: ${uploadError.message}`);
  const report = await require('./supabaseService').insertReport(client, { institution_id: institutionId, report_type: reportType, storage_path: storagePath, created_by: createdBy });
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(storagePath, 15 * 60);
  if (error) throw new Error(`Could not create report link: ${error.message}`);
  return { report, url: data.signedUrl, format: extension };
}

async function generatePredictionReport({ prediction, institutionId, createdBy, format, client }) {
  const content = reportContent(prediction, `${prediction.task_type.replace('_', ' ')} prediction`);
  const extension = format === 'pdf' ? 'pdf' : 'docx';
  const buffer = extension === 'pdf' ? await buildPdf(content) : await buildDocx(content);
  return uploadAndSign({ institutionId, createdBy, reportType: 'predict_report', baseName: `prediction-${prediction.id}-${Date.now()}`, buffer, extension, client });
}

async function generateChatReport({ messages, institutionId, createdBy, format, client }) {
  const transcript = messages.filter((message) => message.role !== 'tool').map((message) => `${message.role === 'user' ? 'You' : 'ZivaDzidzo'}: ${message.content || ''}`).join('\n\n');
  const content = {
    title: 'Chat consultation',
    score: '—',
    band: 'Conversation',
    factors: [],
    actions: ['Review the conversation transcript and any linked assessments with your leadership team.'],
    caveats: 'This transcript may include LLM-reasoned guidance. Treat it as decision support, not a causal or definitive assessment.',
    generatedAt: new Date().toISOString(),
    modelVersion: `${OPENAI_MODELS.CHAT}::chat_consultation_v1`,
  };
  content.executiveSummary = 'This report preserves a leadership consultation transcript. It is not an assessment of an individual learner and should be reviewed alongside the underlying aggregate evidence.';
  const extension = format === 'pdf' ? 'pdf' : 'docx';
  const transcriptParagraphs = transcript
    ? transcript.split('\n\n').map((entry) => new Paragraph({ text: entry }))
    : [new Paragraph({ text: 'No messages yet.' })];
  const buffer = extension === 'pdf'
    ? await buildPdf({ ...content, caveats: `${content.caveats}\n\nTranscript:\n${transcript || 'No messages yet.'}` })
    : await Packer.toBuffer(new Document({ sections: [{ children: [
      new Paragraph({ text: 'ZivaDzidzo decision-support report', heading: HeadingLevel.TITLE }),
      new Paragraph({ text: 'Chat consultation', heading: HeadingLevel.HEADING_1 }),
      new Paragraph({ text: `Generated: ${displayTimestamp(content.generatedAt)}` }),
      new Paragraph({ text: `Model / prompt version: ${content.modelVersion}` }),
      new Paragraph({ text: 'Caveat', heading: HeadingLevel.HEADING_2 }),
      new Paragraph({ text: content.caveats }),
      new Paragraph({ text: 'Transcript', heading: HeadingLevel.HEADING_2 }),
      ...transcriptParagraphs,
    ] }] }));
  return uploadAndSign({ institutionId, createdBy, reportType: 'chat_report', baseName: `chat-${Date.now()}`, buffer, extension, client });
}

async function signedUrlForReport(storagePath) {
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(storagePath, 15 * 60);
  if (error) throw new Error(`Could not create report link: ${error.message}`);
  return data.signedUrl;
}

module.exports = {
  generatePredictionReport,
  generateChatReport,
  signedUrlForReport,
  reportContent,
  buildDocx,
  buildPdf,
  displayTimestamp,
};
