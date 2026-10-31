const PDFDocument = require('pdfkit');
const { fail } = require('./resumeContent');
const { Document, Packer, Paragraph, TextRun, AlignmentType, BorderStyle } = require('docx');
const templates = {
  classic: { font: 'sans', fontSize: 10.5, margin: 48, spacing: 2, color: '#1a1a1a' },
  modern: { font: 'sans', fontSize: 11, margin: 48, spacing: 3, color: '#164a73' },
  compact: { font: 'sans', fontSize: 10, margin: 40, spacing: 1, color: '#1a1a1a' },
};
function settings(input = {}) {
  if (Object.keys(input).some((key) => !['template', 'font', 'fontSize', 'margin', 'spacing', 'preview', 'format'].includes(key))) throw fail('Unsupported export option');
  const template = input.template || 'classic';
  if (!templates[template]) throw fail('Choose a supported resume template');
  const options = { template, ...templates[template] };
  if (input.font !== undefined) {
    if (!['sans', 'serif'].includes(input.font)) throw fail('Choose sans or serif font');
    options.font = input.font;
  }
  for (const [key, min, max] of [['fontSize', 10, 12], ['margin', 36, 64], ['spacing', 1, 4]]) {
    if (input[key] === undefined) continue;
    const number = Number(input[key]);
    if (!Number.isFinite(number) || number < min || number > max) throw fail('Invalid ' + key + ' setting');
    options[key] = number;
  }
  return options;
}
const join = (values, separator = ' | ') => values.filter(Boolean).join(separator);
function sections(content) {
  const groups = [], add = (title, lines) => { const populated = lines.filter((line) => line.text); if (populated.length) groups.push({ title, lines: populated }); };
  const line = (text, style = 'body') => ({ text, style });
  add('PROFESSIONAL SUMMARY', [line(content.summary)]);
  const seen = new Set(), skillLines = [];
  for (const [label, key] of [['Technical skills', 'technical'], ['Frameworks', 'frameworks'], ['Tools & platforms', 'tools'], ['Collaboration', 'soft'], ['Additional skills', 'all']]) {
    const values = (content.skills?.[key] || []).filter((value) => { const normalized = value.trim().toLowerCase(); if (!normalized || seen.has(normalized)) return false; seen.add(normalized); return true; });
    if (values.length) skillLines.push(line(label + ': ' + values.join(', ')));
  }
  add('SKILLS', skillLines);
  add('EXPERIENCE', (content.workExperience || []).flatMap((entry) => [line(join([entry.role, entry.company], ' - '), 'title'),
    line(join([join([entry.startDate, entry.endDate || (entry.current ? 'Present' : '')], ' - '), entry.location]), 'muted'), ...(entry.highlights || []).map((text) => line(text, 'bullet'))]));
  add('PROJECTS', (content.projects || []).flatMap((entry) => [line(entry.title, 'title'), line(entry.description),
    line(entry.technologies?.length ? 'Technologies: ' + entry.technologies.join(', ') : ''), line(entry.link, 'muted'), ...(entry.highlights || []).map((text) => line(text, 'bullet'))]));
  add('EDUCATION', (content.education || []).flatMap((entry) => [line(join([entry.degree, entry.fieldOfStudy], ' - '), 'title'), line(join([entry.institution, entry.graduationYear, entry.score]))]));
  add('CERTIFICATIONS', (content.certifications || []).map((entry) => line(join([entry.name, entry.issuer, entry.year]))));
  return groups;
}
const printable = (value) => String(value || '').replace(/[\u2010-\u2015\u2212]/g, '-').replace(/\u00a0/g, ' ');
async function pdf(content, input = {}, title = 'Resume') {
  const options = settings(input), font = options.font === 'serif' ? 'Times-Roman' : 'Helvetica', bold = options.font === 'serif' ? 'Times-Bold' : 'Helvetica-Bold';
  const doc = new PDFDocument({ margin: options.margin, size: 'A4', bufferPages: true, info: { Title: title, Author: content.contactInfo?.name || '' } });
  const chunks = [], output = new Promise((resolve, reject) => { doc.on('data', (chunk) => chunks.push(chunk)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject); });
  const contact = content.contactInfo || {}, width = doc.page.width - options.margin * 2;
  const room = (height) => { if (doc.y + height > doc.page.height - options.margin) doc.addPage(); };
  doc.font(bold).fillColor(options.color).fontSize(21).text(printable(contact.name || title), { align: options.template === 'modern' ? 'left' : 'center' });
  doc.font(font).fillColor('#333333').fontSize(9.5).text(printable(join([contact.email, contact.phone, contact.location, contact.linkedin, contact.github, contact.portfolio])), { align: options.template === 'modern' ? 'left' : 'center' });
  for (const group of sections(content)) {
    room(65); doc.moveDown(.65).font(bold).fillColor(options.color).fontSize(options.fontSize + 1.5).text(group.title);
    if (options.template !== 'compact') { const y = doc.y + 2; doc.save().strokeColor(options.color).lineWidth(.5).moveTo(options.margin, y).lineTo(doc.page.width - options.margin, y).stroke().restore(); }
    doc.moveDown(.5);
    for (const item of group.lines) {
      room(item.style === 'title' ? 48 : options.fontSize * 2);
      if (item.style === 'title') doc.moveDown(.25);
      doc.font(item.style === 'title' ? bold : font).fontSize(item.style === 'muted' ? options.fontSize - .5 : options.fontSize).fillColor(item.style === 'muted' ? '#454545' : '#1a1a1a');
      const bullet = item.style === 'bullet';
      doc.text(printable((bullet ? '• ' : '') + item.text), options.margin + (bullet ? 8 : 0), doc.y, { width: width - (bullet ? 8 : 0), lineGap: options.spacing, paragraphGap: options.spacing });
    }
  }
  const range = doc.bufferedPageRange(), pages = range.count;
  for (let index = 0; index < pages; index++) {
    doc.switchToPage(index); const bottom = doc.page.margins.bottom; doc.page.margins.bottom = 0;
    doc.font(font).fontSize(8).fillColor('#666666').text((index + 1) + ' / ' + pages, options.margin, doc.page.height - options.margin / 2, { width, align: 'right', lineBreak: false });
    doc.page.margins.bottom = bottom;
  }
  doc.end(); return { buffer: await output, pages, options };
}
async function docx(content, input = {}, title = 'Resume') {
  const options = settings(input), font = options.font === 'serif' ? 'Times New Roman' : 'Arial', contact = content.contactInfo || {};
  const paragraph = (text, extra = {}) => new Paragraph({ spacing: { after: options.spacing * 40, line: 260 }, ...extra,
    children: [new TextRun({ text: printable(text), size: Math.round(options.fontSize * 2), ...extra.run })] });
  const children = [paragraph(contact.name || title, { alignment: options.template === 'modern' ? AlignmentType.LEFT : AlignmentType.CENTER, run: { bold: true, size: 40, color: options.color.slice(1) } }),
    paragraph(join([contact.email, contact.phone, contact.location, contact.linkedin, contact.github, contact.portfolio]), { run: { size: 19 } })];
  for (const group of sections(content)) {
    children.push(paragraph(group.title, { spacing: { before: 220, after: 120 }, keepNext: true,
      border: options.template === 'compact' ? undefined : { bottom: { color: 'AAAAAA', style: BorderStyle.SINGLE, size: 4, space: 4 } }, run: { bold: true, color: options.color.slice(1), size: Math.round((options.fontSize + 1.5) * 2) } }));
    group.lines.forEach((item) => children.push(paragraph(item.text, { ...(item.style === 'bullet' ? { bullet: { level: 0 } } : {}), keepNext: item.style === 'title', run: { bold: item.style === 'title' } })));
  }
  const document = new Document({ title, creator: contact.name || '', styles: { default: { document: { run: { font, size: Math.round(options.fontSize * 2) } } } },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: Object.fromEntries(['top', 'bottom', 'left', 'right'].map((key) => [key, Math.round(options.margin * 20)])) } }, children }] });
  return { buffer: await Packer.toBuffer(document), options };
}
module.exports = { pdf, docx, settings, sections, templates };
