const PDFDocument = require('pdfkit');
const { fail } = require('./resumeContent');
const { presentation, sectionKeys } = require('./resumeStructure');
const fonts = require('./exportFonts');
const { Document, Packer, Paragraph, TextRun, AlignmentType, BorderStyle, ExternalHyperlink } = require('docx');
const templates = {
  classic: { font: 'sans', fontSize: 10.5, margin: 48, spacing: 2, color: '#1a1a1a' },
  modern: { font: 'sans', fontSize: 11, margin: 48, spacing: 3, color: '#164a73' },
  compact: { font: 'sans', fontSize: 10, margin: 40, spacing: 1, color: '#1a1a1a' },
};
function settings(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some((key) => !['template', 'font', 'fontSize', 'margin', 'spacing', 'preview', 'format', 'pageBreakBefore', 'keepEntriesTogether'].includes(key))) throw fail('Unsupported export option');
  const template = input.template || 'classic';
  if (!Object.hasOwn(templates, template)) throw fail('Choose a supported resume template');
  const options = { template, ...templates[template], pageBreakBefore: [], keepEntriesTogether: true };
  if (input.font !== undefined) { if (!['sans', 'serif'].includes(input.font)) throw fail('Choose sans or serif font'); options.font = input.font; }
  for (const [key, min, max] of [['fontSize', 10, 12], ['margin', 36, 64], ['spacing', 1, 4]]) {
    if (input[key] === undefined) continue;
    const number = Number(input[key]); if (!Number.isFinite(number) || number < min || number > max) throw fail('Invalid ' + key + ' setting'); options[key] = number;
  }
  if (input.pageBreakBefore !== undefined) {
    const values = typeof input.pageBreakBefore === 'string' ? input.pageBreakBefore.split(',').filter(Boolean) : input.pageBreakBefore;
    if (!Array.isArray(values) || values.length > 6 || new Set(values).size !== values.length || values.some((key) => !sectionKeys.includes(key))) throw fail('Choose valid section page breaks');
    options.pageBreakBefore = values;
  }
  if (input.keepEntriesTogether !== undefined) {
    if (![true, false, 'true', 'false'].includes(input.keepEntriesTogether)) throw fail('Choose whether entries should stay together');
    options.keepEntriesTogether = input.keepEntriesTogether === true || input.keepEntriesTogether === 'true';
  }
  return options;
}
const join = (values, separator = ' | ') => values.filter(Boolean).join(separator);
const printable = (value) => String(value || '').replace(/[\u2010-\u2015\u2212]/g, '-').replace(/\u00a0/g, ' ');
function sections(content, layout) {
  const groups = [], line = (text, style = 'body') => ({ text: printable(text), style });
  const add = (key, title, blocks) => { blocks = blocks.map((block) => block.filter((item) => item.text)).filter((block) => block.length); if (blocks.length) groups.push({ key, title, blocks, lines: blocks.flat() }); };
  add('summary', 'PROFESSIONAL SUMMARY', [[line(content.summary)]]);
  const seen = new Set(), skills = [];
  for (const [label, key] of [['Technical skills', 'technical'], ['Frameworks', 'frameworks'], ['Tools & platforms', 'tools'], ['Collaboration', 'soft'], ['Additional skills', 'all']]) {
    const values = (content.skills?.[key] || []).filter((value) => { const key = value.trim().toLowerCase(); if (!key || seen.has(key)) return false; seen.add(key); return true; });
    if (values.length) skills.push(line(label + ': ' + values.join(', ')));
  }
  add('skills', 'SKILLS', skills.map((item) => [item]));
  add('workExperience', 'EXPERIENCE', (content.workExperience || []).map((entry) => [line(join([entry.role, entry.company], ' - '), 'title'), line(join([join([entry.startDate, entry.current ? 'Present' : entry.endDate], ' - '), entry.location]), 'muted'), ...(entry.highlights || []).map((text) => line(text, 'bullet'))]));
  add('projects', 'PROJECTS', (content.projects || []).map((entry) => [line(entry.title, 'title'), line(entry.description), line(entry.technologies?.length ? 'Technologies: ' + entry.technologies.join(', ') : ''), line(entry.link, 'link'), ...(entry.highlights || []).map((text) => line(text, 'bullet'))]));
  add('education', 'EDUCATION', (content.education || []).map((entry) => [line(join([entry.degree, entry.fieldOfStudy], ' - '), 'title'), line(join([entry.institution, entry.graduationYear, entry.score]))]));
  add('certifications', 'CERTIFICATIONS', (content.certifications || []).map((entry) => [line(join([entry.name, entry.issuer, entry.year]))]));
  const order = presentation(layout).sectionOrder;
  return groups.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
}
async function pdf(content, input = {}, title = 'Resume', layout) {
  const options = settings(input), width = 595.28 - options.margin * 2;
  // Verify font coverage before opening a PDF stream so unsupported text fails cleanly.
  const groups = sections(content, layout), contact = content.contactInfo || {};
  for (const text of [contact.name || title, ...Object.values(contact).filter((value) => typeof value === 'string'), ...groups.flatMap((group) => group.lines.map((item) => item.text))]) fonts.measure(printable(text), options.font, false, options.fontSize, width, options.spacing);
  const doc = new PDFDocument({ margin: options.margin, size: 'A4', bufferPages: true, info: { Title: title, Author: contact.name || '' } });
  const chunks = [], output = new Promise((resolve, reject) => { doc.on('data', (chunk) => chunks.push(chunk)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject); });
  const fullHeight = doc.page.height - options.margin * 2;
  const room = (height) => { if (height <= fullHeight && doc.y + height > doc.page.height - options.margin) doc.addPage(); };
  const write = (text, size, bold = false, extra = {}) => fonts.write(doc, printable(text), { family: options.font, size, bold, color: bold ? options.color : '#1a1a1a', x: options.margin, width, spacing: options.spacing, ...extra });
  write(contact.name || title, 21, true, { align: options.template === 'modern' ? 'left' : 'center' });
  write(join([contact.email, contact.phone, contact.location]), 9.5, false, { align: options.template === 'modern' ? 'left' : 'center' });
  for (const link of [contact.linkedin, contact.github, contact.portfolio].filter(Boolean)) write(link, 9.5, false, { link: /^https?:\/\//i.test(link) ? link : undefined, align: options.template === 'modern' ? 'left' : 'center' });
  const lineHeight = (item) => fonts.measure((item.style === 'bullet' ? '• ' : '') + item.text, options.font, item.style === 'title', item.style === 'muted' || item.style === 'link' ? options.fontSize - .5 : options.fontSize, width - (item.style === 'bullet' ? 8 : 0), options.spacing) + (item.style === 'title' ? 4 : 0);
  for (const group of groups) {
    if (options.pageBreakBefore.includes(group.key) && doc.y > options.margin + 2) doc.addPage();
    const first = group.blocks[0], firstHeight = first.reduce((sum, item) => sum + lineHeight(item), 0);
    room(45 + (options.keepEntriesTogether && firstHeight < fullHeight - 60 ? firstHeight : first.slice(0, 2).reduce((sum, item) => sum + lineHeight(item), 0)));
    doc.y += 10; write(group.title, options.fontSize + 1.5, true);
    if (options.template !== 'compact') { const y = doc.y + 2; doc.save().strokeColor(options.color).lineWidth(.5).moveTo(options.margin, y).lineTo(doc.page.width - options.margin, y).stroke().restore(); }
    doc.y += 8;
    for (const [blockIndex, block] of group.blocks.entries()) {
      if (options.keepEntriesTogether && blockIndex) room(block.reduce((sum, item) => sum + lineHeight(item), 0) + 5);
      for (const item of block) {
        room(item.style === 'title' ? lineHeight(item) + (block[1] ? lineHeight(block[1]) : 0) : options.fontSize * 1.6);
        if (item.style === 'title') doc.y += 3;
        const bullet = item.style === 'bullet';
        write((bullet ? '• ' : '') + item.text, item.style === 'muted' || item.style === 'link' ? options.fontSize - .5 : options.fontSize, item.style === 'title', { color: item.style === 'muted' || item.style === 'link' ? '#454545' : item.style === 'title' ? options.color : '#1a1a1a', x: options.margin + (bullet ? 8 : 0), width: width - (bullet ? 8 : 0), ...(item.style === 'link' && /^https?:\/\//i.test(item.text) ? { link: item.text } : {}) });
      }
    }
  }
  const pages = doc.bufferedPageRange().count;
  fonts.register(doc, options.font);
  for (let index = 0; index < pages; index++) {
    doc.switchToPage(index); const bottom = doc.page.margins.bottom; doc.page.margins.bottom = 0;
    doc.font(options.font).fontSize(8).fillColor('#666666').text((index + 1) + ' / ' + pages, options.margin, doc.page.height - options.margin / 2, { width, align: 'right', lineBreak: false });
    doc.page.margins.bottom = bottom;
  }
  doc.end(); return { buffer: await output, pages, options };
}
async function docx(content, input = {}, title = 'Resume', layout) {
  const options = settings(input), font = options.font === 'serif' ? 'Noto Serif' : 'Noto Sans', contact = content.contactInfo || {};
  const paragraph = (text, extra = {}) => new Paragraph({ spacing: { after: options.spacing * 40, line: 280 }, ...extra, children: [new TextRun({ text: printable(text), size: Math.round(options.fontSize * 2), ...extra.run })] });
  const children = [paragraph(contact.name || title, { alignment: options.template === 'modern' ? AlignmentType.LEFT : AlignmentType.CENTER, run: { bold: true, size: 40, color: options.color.slice(1) } }), paragraph(join([contact.email, contact.phone, contact.location]), { run: { size: 19 } })];
  for (const link of [contact.linkedin, contact.github, contact.portfolio].filter(Boolean)) children.push(new Paragraph({ children: [/^https?:\/\//i.test(link) ? new ExternalHyperlink({ link, children: [new TextRun({ text: printable(link), size: 19, style: 'Hyperlink' })] }) : new TextRun(printable(link))] }));
  for (const group of sections(content, layout)) {
    children.push(paragraph(group.title, { spacing: { before: 220, after: 120 }, keepNext: true, pageBreakBefore: options.pageBreakBefore.includes(group.key), border: options.template === 'compact' ? undefined : { bottom: { color: 'AAAAAA', style: BorderStyle.SINGLE, size: 4, space: 4 } }, run: { bold: true, color: options.color.slice(1), size: Math.round((options.fontSize + 1.5) * 2) } }));
    for (const block of group.blocks) block.forEach((item, index) => children.push(paragraph(item.text, { ...(item.style === 'bullet' ? { bullet: { level: 0 } } : {}), keepLines: true, keepNext: item.style === 'title' || options.keepEntriesTogether && index < block.length - 1, run: { bold: item.style === 'title' } })));
  }
  const document = new Document({ title, creator: contact.name || '', styles: { default: { document: { run: { font, size: Math.round(options.fontSize * 2) } } } }, sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: Object.fromEntries(['top', 'bottom', 'left', 'right'].map((key) => [key, Math.round(options.margin * 20)])) } }, children }] });
  return { buffer: await Packer.toBuffer(document), options };
}
module.exports = { pdf, docx, settings, sections, templates };
