const path = require('node:path');
const fs = require('node:fs');
const fontkit = require('fontkit');
const { fail } = require('./resumeContent');
const names = {
  sans: 'NotoSans-Regular.ttf', sansBold: 'NotoSans-Bold.ttf', serif: 'NotoSerif-Regular.ttf', serifBold: 'NotoSerif-Bold.ttf',
  deva: 'NotoSansDevanagari-Regular.ttf', devaBold: 'NotoSansDevanagari-Bold.ttf', cjk: 'NotoSansCJKsc-Regular.otf',
};
const cache = new Map(), registered = new WeakMap(), segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
function get(name) {
  if (!cache.has(name)) { const buffer = fs.readFileSync(path.join(__dirname, '../assets/fonts', names[name])); cache.set(name, { buffer, face: fontkit.create(buffer) }); }
  return cache.get(name);
}
function runs(text, family, bold) {
  const preferred = family + (bold ? 'Bold' : ''), candidates = [preferred, bold ? 'devaBold' : 'deva', 'cjk'], result = [];
  for (const { segment } of segmenter.segment(text)) {
    const codepoints = [...segment].filter((char) => !/[\s\p{Cf}]/u.test(char)).map((char) => char.codePointAt(0));
    const name = candidates.find((candidate) => codepoints.every((point) => get(candidate).face.hasGlyphForCodePoint(point)));
    if (!name) throw fail('A character in this resume is outside the bundled font coverage. Use DOCX or replace that character before exporting PDF.');
    const last = result.at(-1); if (last?.name === name) last.text += segment; else result.push({ name, text: segment });
  }
  return result;
}
function measure(text, family, bold, size, width, spacing) {
  let lineWidth = 0, lines = 1, lineHeight = 0;
  const runWidth = (value) => runs(value, family, bold).reduce((sum, run) => {
    const face = get(run.name).face; lineHeight = Math.max(lineHeight, (face.ascent - face.descent + face.lineGap) / face.unitsPerEm * size);
    return sum + face.layout(run.text).positions.reduce((total, item) => total + item.xAdvance, 0) / face.unitsPerEm * size;
  }, 0);
  // Conservative word/grapheme wrapping keeps entries together without clipping long URLs.
  for (const token of text.match(/\n|[^\S\n]+|[^\s]+/gu) || []) {
    if (token === '\n') { lines++; lineWidth = 0; continue; }
    const length = runWidth(token);
    if (length <= width) { if (lineWidth + length > width) { lines++; lineWidth = 0; } lineWidth += length; }
    else for (const { segment } of segmenter.segment(token)) { const length = runWidth(segment); if (lineWidth + length > width) { lines++; lineWidth = 0; } lineWidth += length; }
  }
  return lines * ((lineHeight || size * 1.4) + spacing) + spacing;
}
function register(doc, name) { let names = registered.get(doc); if (!names) { names = new Set(); registered.set(doc, names); } if (!names.has(name)) { doc.registerFont(name, get(name).buffer); names.add(name); } }
function write(doc, text, { family, bold = false, size, color = '#1a1a1a', x, width, align = 'left', spacing = 2, link }) {
  const fragments = runs(text, family, bold);
  if (!fragments.length) return;
  const primary = get(family + (bold ? 'Bold' : '')).face;
  const baseline = -primary.ascent / primary.unitsPerEm * size;
  // PDFKit centers each continued font run separately. Position mixed-font lines once.
  if (fragments.length > 1 && align === 'center') {
    const length = fragments.reduce((sum, fragment) => { const face = get(fragment.name).face; return sum + face.layout(fragment.text).positions.reduce((total, item) => total + item.xAdvance, 0) / face.unitsPerEm * size; }, 0);
    if (length < width) { x += (width - length) / 2; width = length + .5; }
    align = 'left';
  }
  for (let index = 0; index < fragments.length; index++) {
    const fragment = fragments[index]; register(doc, fragment.name); doc.font(fragment.name).fontSize(size).fillColor(color);
    const options = { width, align, baseline, lineGap: spacing, paragraphGap: spacing, continued: index < fragments.length - 1, ...(link ? { link } : {}) };
    if (!index) doc.text(fragment.text, x, doc.y, options); else doc.text(fragment.text, options);
  }
}
module.exports = { get, write, measure, register };
