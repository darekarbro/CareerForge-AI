const aliases = {
  summary: ['summary', 'profile', 'objective', 'about me'].flatMap(label => [label, 'professional ' + label]),
  skills: ['skills', 'competencies', 'technologies'].flatMap(label => [label, ...['technical', 'core', 'key'].map(prefix => prefix + ' ' + label)]),
  experience: ['experience', 'employment', 'work history'].flatMap(label => [label, ...['professional', 'work', 'relevant'].map(prefix => prefix + ' ' + label)]),
  education: ['education', 'academic background', 'qualifications'],
  projects: ['project', 'projects', 'personal projects', 'key projects', 'selected projects', 'academic projects'],
  certifications: ['certification', 'certifications', 'certificate', 'certificates', 'license', 'licenses'],
};
const compact = value => value.toLowerCase().replace(/\s+/gu, '');
const known = new Map(Object.entries(aliases).flatMap(([section, labels]) => labels.map(label => [compact(label), section])));
const frame = line => line.trim().replace(/^#{1,6}\s+/, '').replace(/^\|\s*|\s*\|$/g, '').trim();
const separator = line => !line.trim() || /^[\s+|:═─┌┐└┘├┤┬┴┼=._-]+$/.test(line);

function headingSection(value) {
  const text = frame(value).replace(/\s*(?::+|[.\s]{2,}|[=>-]+)\s*$/, '').trim();
  const exact = known.get(compact(text));
  if (exact) return exact;
  const label = text.toLowerCase().replace(/[_/+-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!label || label.length > 75 || /[.!?@,'";]|\b(?:not|never|cannot)\b/i.test(label)) return null;
  if (/^(?:(?:my|self|personal|candidate|signed|skill)\s+){0,3}(?:declaration|statement|assessment|note)s?$/.test(label)
    || /^(?:context|notes?)\b/.test(label) || /^(?:who i am|about(?: me)?(?: experience)?|introduction|overview)$/.test(label)) return 'summary';
  if (/^(?:contact|correspondence|reach me|identity(?: and contact)?|personal details|career contact)$/.test(label)) return 'header';
  if (/^(?:(?:formal|academic|learning|educational|my)\s+){0,2}(?:study|studies|education|training|learning|qualifications)(?:\s+(?:record|and training))?$/.test(label)
    || /^academic record$/.test(label)) return 'education';
  if (/^(?:(?:my|technical|core|key|professional|practical)\s+){0,3}(?:skills?|capabilities|competencies|technologies|toolbox|repertoire|tools|stack|proficiencies)(?:\s+(?:summary|i use|and how i use them))?$/.test(label)
    || /^(?:how i (?:build|ship|work|develop)|what i (?:use|know)|work skills)$/.test(label)) return 'skills';
  if (/^(?:(?:my|current|selected|engineering|professional|relevant|work|career|past|role)\s+){0,3}(?:practice|record|history|experience|employment|appointments|work|career|role)$/.test(label)
    || /^what i (?:have )?(?:built|delivered|implemented)$/.test(label)) return 'experience';
  if (/^(?:(?:my|selected|personal|academic|project)\s+){0,2}(?:projects?|portfolio|account|contributions|deliveries)$/.test(label)) return 'projects';
  return null;
}

function inlineSection(line) {
  // Try only short label prefixes, so arbitrary prose is never stripped as a heading.
  for (const delimiter of line.matchAll(/::+|=>|->|[:|｜>]|\t+|\s+[—–/-](?:\s+|$)/g)) {
    if (delimiter.index > 90) break;
    const section = headingSection(line.slice(0, delimiter.index));
    if (section) return { section, text: line.slice(delimiter.index + delimiter[0].length).trim() };
  }
  return null;
}

function splitResumeSections(text) {
  const parts = { header: [] }, statements = [];
  let current = 'header', columns = null;
  const emit = (value, section, line) => {
    if (!value.trim()) { (parts[section] ||= []).push(''); return; }
    const context = section === 'skills' ? 'skills' : section === 'header' ? 'unknown' : 'narrative';
    (parts[section] ||= []).push(value);
    statements.push({ text: value, section, context, line });
  };
  String(text).split(/\r?\n/).forEach((raw, index) => {
    if (separator(raw)) { if (!raw.trim()) emit('', current, index + 1); return; }
    const line = frame(raw);
    const cells = line.split(/\s*\|\s*|\t+| {2,}/).map(value => value.trim()).filter(Boolean);
    const headings = cells.map(headingSection);
    if (cells.length > 1 && headings.every(Boolean)) { columns = headings; current = headings[0]; return; }
    const section = headingSection(line);
    if (section) { current = section; columns = null; parts[current] ||= []; return; }
    const inline = inlineSection(line);
    if (inline) { current = inline.section; columns = null; emit(inline.text, current, index + 1); return; }
    if (columns && cells.length > 1) {
      cells.forEach((cell, column) => emit(cell, columns[column] || current, index + 1));
      return;
    }
    // Unrecognized blocks remain observable to the source-claim classifier, even without a heading.
    emit(line, current, index + 1);
  });
  return { parts, statements };
}

module.exports = { splitResumeSections, headingSection, inlineSection };
