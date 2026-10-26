const test = require('node:test');
const assert = require('node:assert/strict');
const PDFDocument = require('pdfkit');
const parser = require('../src/agents/parserAgent');

test('PDF extraction accepts a valid PDF held in a shared Node Buffer view', async () => {
  const doc = new PDFDocument();
  const chunks = [];
  const finished = new Promise((resolve, reject) => {
    doc.on('data', (chunk) => chunks.push(chunk)); doc.on('end', resolve); doc.on('error', reject);
  });
  doc.fontSize(20).text('Alex Example');
  doc.fontSize(12).text('Backend developer: Node.js, Express, MongoDB');
  doc.text('Education: BSc Computer Science, Example University, 2022');
  doc.end(); await finished;
  const pdf = Buffer.concat(chunks);
  const backing = Buffer.alloc(pdf.length + 256, 0xaa);
  pdf.copy(backing, 128);
  const view = backing.subarray(128, 128 + pdf.length);
  const text = await parser.extractTextFromBuffer(view, 'pdf');
  assert(text.includes('Alex Example'));
  assert(text.includes('Example University'));
  assert(text.includes('Node.js'));
});
