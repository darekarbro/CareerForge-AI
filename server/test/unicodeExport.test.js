const { test } = require('node:test'), assert = require('node:assert/strict');
const exporter = require('../src/services/resumeExport'), parser = require('../src/agents/parserAgent');
test('Phase 2: all PDF templates embed fonts and preserve international names, long links and late sections', async () => {
  const content = structuredClone(require('./fixtures/resumes').experienced);
  content.contactInfo.name = 'Zoë García · Łukasz Müller · ओम दरेकर · 李明';
  const link = 'https://example.test/portfolio/' + 'long-research-link-'.repeat(35); content.contactInfo.portfolio = link;
  for (const template of ['classic', 'modern', 'compact']) {
    const result = await exporter.pdf(content, { template, pageBreakBefore: ['education'] }, 'Fictional international resume');
    assert(result.pages >= 3); assert.match(result.buffer.toString('latin1'), /\/FontFile[23]/);
    const text = await parser.extractTextFromBuffer(result.buffer, 'pdf');
    for (const fact of ['Zoë García', 'Łukasz Müller', 'ओम दरेकर', '李明', 'Example Company 6', 'Example Python Course']) assert(text.includes(fact), template + ': ' + fact);
    assert(text.replace(/\s/g, '').includes(link), 'Full long link survives wrapping');
  }
  const docx = await exporter.docx(content, { pageBreakBefore: ['education'] }); const text = (await require('mammoth').extractRawText({ buffer: docx.buffer })).value; assert(text.includes(content.contactInfo.name)); assert(text.includes(link));
  await assert.rejects(exporter.pdf({ ...content, summary: 'Unsupported emoji 🦄' }), /outside the bundled font coverage/);
});
