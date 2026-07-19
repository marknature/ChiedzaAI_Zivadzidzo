const { Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun } = require('docx');
const PDFDocument = require('pdfkit');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const { supabaseAdmin } = require('../db');
const { TABLES } = require('../config');

const BUCKET = process.env.SUPABASE_REPORTS_BUCKET || 'reports';
const chartCanvas = new ChartJSNodeCanvas({ width: 800, height: 380, backgroundColour: '#ffffff' });

function safeText(value) { return value === null || value === undefined ? 'Not available' : String(value); }
function reportContent(prediction, title) {
  const data = prediction.prediction || {};
  const rationale = prediction.rationale || {};
  return { title, score: data.ai_disruption_exposure_score ?? data.pass_rate_resilience_score ?? data.curriculum_readiness_score ?? '—', band: data.exposure_band ?? data.trajectory_band ?? data.readiness_band ?? '—', actions: data.recommended_actions || [], factors: rationale.contributing_factors || [], caveats: rationale.caveats || 'This is LLM-reasoned and associational, not causal.' };
}

async function chartFor(content) {
  const weights = content.factors.slice(0, 5);
  return chartCanvas.renderToBuffer({ type: 'bar', data: { labels: weights.map((item) => item.factor), datasets: [{ label: 'Relative weight', data: weights.map((item) => item.relative_weight), backgroundColor: '#2FBF9F' }] }, options: { indexAxis: 'y', scales: { x: { min: 0, max: 1 } }, plugins: { legend: { display: false } } } });
}

async function buildDocx(content) {
  const chart = await chartFor(content);
  const children = [new Paragraph({ text: 'ZivaDzidzo report', heading: HeadingLevel.TITLE }), new Paragraph({ text: content.title, heading: HeadingLevel.HEADING_1 }), new Paragraph({ children: [new TextRun({ text: `Score: ${content.score} (${content.band})`, bold: true })] }), new Paragraph({ text: 'What influenced this score', heading: HeadingLevel.HEADING_2 }), ...content.factors.map((factor) => new Paragraph({ text: `${factor.factor}: ${safeText(factor.evidence)} (${Math.round(Number(factor.relative_weight || 0) * 100)}%)`, bullet: { level: 0 } })), new Paragraph({ children: [new ImageRun({ data: chart, transformation: { width: 560, height: 266 }, type: 'png' })] }), new Paragraph({ text: 'Recommended next moves', heading: HeadingLevel.HEADING_2 }), ...content.actions.map((action) => new Paragraph({ text: action, bullet: { level: 0 } })), new Paragraph({ text: 'Caveat', heading: HeadingLevel.HEADING_2 }), new Paragraph({ text: content.caveats })];
  return Packer.toBuffer(new Document({ sections: [{ children }] }));
}

async function buildPdf(content) {
  return new Promise((resolve, reject) => { const doc = new PDFDocument({ margin: 48 }); const chunks = []; doc.on('data', (chunk) => chunks.push(chunk)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject); doc.fontSize(20).text('ZivaDzidzo report'); doc.moveDown().fontSize(15).text(content.title); doc.fontSize(12).text(`Score: ${content.score} (${content.band})`); doc.moveDown().fontSize(14).text('Recommended next moves'); content.actions.forEach((action) => doc.fontSize(11).text(`• ${action}`)); doc.moveDown().fontSize(14).text('Caveat'); doc.fontSize(11).text(content.caveats); doc.end(); });
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
  const content = { title: 'Chat consultation', score: '—', band: 'Conversation', factors: [], actions: ['Review the conversation transcript and the linked predictions with your leadership team.'], caveats: 'This transcript may include LLM-reasoned guidance. Treat it as decision support, not a causal or definitive assessment.' };
  const extension = format === 'pdf' ? 'pdf' : 'docx';
  const buffer = extension === 'pdf' ? await buildPdf({ ...content, caveats: `${content.caveats}\n\nTranscript:\n${transcript}` }) : await Packer.toBuffer(new Document({ sections: [{ children: [new Paragraph({ text: 'ZivaDzidzo chat report', heading: HeadingLevel.TITLE }), new Paragraph({ text: transcript || 'No messages yet.' })] }] }));
  return uploadAndSign({ institutionId, createdBy, reportType: 'chat_report', baseName: `chat-${Date.now()}`, buffer, extension, client });
}

async function signedUrlForReport(storagePath) {
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(storagePath, 15 * 60);
  if (error) throw new Error(`Could not create report link: ${error.message}`);
  return data.signedUrl;
}

module.exports = { generatePredictionReport, generateChatReport, signedUrlForReport };
