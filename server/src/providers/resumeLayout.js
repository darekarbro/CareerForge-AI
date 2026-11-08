const { nonCandidateClause } = require('./skillPolarity');

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
// These labels describe a capability category only when paired with a payload.
// Keeping them separate from whole-section headings avoids reclassifying prose
// merely because it starts with a broad word such as "Application" or "Cloud".
const skillCategory = /^(?:web|frontend|front end|backend|back end|server|application|cloud|data|storage|database(?: language)?|testing|tests|checks|delivery|deployment|workflow|focus|strengths|work areas?)$/i;
const normalizedLabel = value => value.trim().replace(/[_/+-]/g, ' ').replace(/\s+/g, ' ');
const externalLabel = /^(?:reference (?:context|quote|quotation|statement)|(?:job|role|position) (?:description|requirements)|(?:copied|quoted|external) (?:(?:job|role|position) )?(?:description|requirements|skills|assignment|brief)|(?:assignment|project) brief|requested approach|(?:hiring manager|recruiter|employer) (?:quote|requirements|statement)|(?:quoted|copied) from (?:the )?(?:hiring manager|recruiter|employer|job description)|forwarding (?:slip|note|message)|(?:training|course|study) i (?:plan|intend|hope) to (?:take|start|complete)|(?:future|planned|proposed) (?:training|study|learning))$/i;
const ownedCapability = /^(?:(?:tools?|languages?|platforms?|technologies|frameworks?|libraries|databases?|skills?) i (?:used?|work(?:ed)? with)|what i (?:built|wrote|implemented|configured|developed))$/i;
const usageHeading = /^(?:tools?|languages?|platforms?|technologies|frameworks?|libraries|databases?|skills?)\s+(.+\s+(?:used?|uses|works? with|worked with))$/i;

function headingSection(value) {
  const text = frame(value).replace(/\s*(?::+|[.\s]{2,}|[=>-]+)\s*$/, '').replace(/^\[([^\[\]]+)\]$/, '$1').trim();
  const exact = known.get(compact(text));
  if (exact) return exact;
  const label = text.toLowerCase().replace(/[_/+-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (externalLabel.test(label)) return 'external';
  if (!label || label.length > 75 || /[.!?@,'";]|\b(?:not|never|cannot)\b/i.test(label)) return null;
  const owner = usageHeading.exec(label);
  if (owner && nonCandidateClause(owner[1])) return 'external';
  if (ownedCapability.test(label) && !/^what\b/.test(label)) return 'skills';
  if (/^(?:(?:my|self|personal|candidate|signed|skill)\s+){0,3}(?:declaration|statement|assessment|note)s?$/.test(label)
    || /^(?:(?:my|personal|candidate|skills?|project|resume|background)\s+){0,2}(?:correction|clarification|amendment|addendum|note)(?:\s+(?:to this resume|from the candidate))?$/.test(label)
    || /^(?:context|notes?)\b/.test(label) || /^(?:who i am|about(?: me)?(?: experience)?|about my work|introduction|overview)$/.test(label)) return 'summary';
  if (/^(?:contact|correspondence|reach me|identity(?: and contact)?|personal details|career contact|applicant|(?:applicant|candidate) (?:resume|cv|details))$/.test(label)) return 'header';
  if (/^(?:(?:formal|academic|learning|educational|my)\s+){0,2}(?:study|studies|education|training|learning|qualifications)(?:\s+(?:record|and training))?$/.test(label)
    || /^academic record$/.test(label)) return 'education';
  if (/^(?:(?:my|candidate|personal|self|technical|core|key|professional|practical|selected|current|delivery|cloud|application|development|work|team)\s+){0,3}(?:skills?|capabilities|competencies|technologies|toolbox|toolkit|repertoire|tools|tooling|stack|proficiencies|kit)(?:\s+(?:summary|list|sheet|i use|and how i use them))?$/.test(label)
    || /^(?:technical notes|team practices|how i (?:build|ship|work|develop)|what i (?:use|know|work with)|work skills)$/.test(label)) return 'skills';
  if (/^(?:(?:my|current|selected|engineering|professional|relevant|work|career|past|role)\s+){0,3}(?:practice|record|history|experience|employment|appointments|work|career|role)$/.test(label)
    || /^what i (?:have )?(?:built|delivered|implemented)$/.test(label)) return 'experience';
  if (/^(?:(?:my|recent|selected|personal|academic|project)\s+){0,2}(?:projects?|portfolio|account|contributions|deliveries|work samples?)$/.test(label)) return 'projects';
  return null;
}

function inlineSection(line) {
  const bracket = line.indexOf('[');
  if (bracket > 0 && bracket <= 75) {
    const prefix = line.slice(0, bracket).trim();
    const section = headingSection(prefix);
    if (section === 'skills' || section === 'external' || skillCategory.test(normalizedLabel(prefix))) {
      return { section: section === 'external' ? 'external' : 'skills', text: line.slice(bracket + 1, /\]\s*$/.test(line) ? line.lastIndexOf(']') : undefined).trim() };
    }
  }
  // Try only short label prefixes, so arbitrary prose is never stripped as a heading.
  for (const delimiter of line.matchAll(/::+|\/{2,}|=>|->|\.{2,}|[:=|｜>→]|\t+|\s+[—–/-](?:\s+|$)/g)) {
    if (delimiter.index > 90) break;
    const prefix = line.slice(0, delimiter.index);
    const text = line.slice(delimiter.index + delimiter[0].length).trim();
    // Keyed form fields have their own context. The next row can describe a different source.
    if (ownedCapability.test(normalizedLabel(prefix)) && /^(?:=|\.{2,}|→)$/.test(delimiter[0])) return { section: 'skills', text, isolated: true };
    const section = headingSection(prefix) || (skillCategory.test(normalizedLabel(prefix)) ? 'skills' : null);
    if (section) return { section, text };
  }
  return null;
}

function personalRecovery(line, section, nextLines) {
  // A copied source can contain its own Skills/Cloud/Experience subheadings.
  // Blank lines and those nested headings cannot change the owner back to the candidate.
  if (/^(?:my|candidate|personal|self|signed)\s+(?:resume|profile|skills?|capabilities|competencies|technologies|toolbox|toolkit|tools?|tooling|stack|declaration|statement|assessment|clarification|correction|experience|education|projects?)\b/i.test(line)) return true;
  if (/^(?:(?:candidate|applicant)\s+)?(?:resume|cv)\s*$/i.test(line)) return true;
  if (!['experience', 'projects', 'education'].includes(section)) return false;
  const entry = [line, ...nextLines].join('\n');
  // A dated career entry establishes a resume boundary more clearly than the
  // generic heading alone; copied experience requirements stay external.
  return /\b(?:19|20)\d{2}\s*(?:[-–—]|to)\s*(?:(?:19|20)\d{2}|present|current|now)\b/i.test(entry);
}

function splitResumeSections(text) {
  const source = String(text), lines = source.split(/\r?\n/), offsets = [];
  let offset = 0;
  for (const line of lines) { offsets.push(offset); offset += line.length + (source.slice(offset + line.length, offset + line.length + 2) === '\r\n' ? 2 : 1); }
  const parts = { header: [] }, statements = [];
  const transcript = lines.some(line => /^(?:interviewer|moderator)\s*:/i.test(frame(line)));
  let current = 'header', columns = null, tableBreak = false, transcriptActive = false;
  const emit = (value, section, line, columnStart = 0) => {
    if (!value.trim()) { (parts[section] ||= []).push(''); return; }
    const context = section === 'external' ? 'external' : section === 'skills' ? 'skills' : section === 'header' ? 'unknown' : 'narrative';
    (parts[section] ||= []).push(value);
    const start = offsets[line - 1] + lines[line - 1].indexOf(value, columnStart);
    statements.push({ text: value, section, context, line, start, end: start + value.length });
  };
  lines.forEach((raw, index) => {
    if (separator(raw)) {
      if (!raw.trim()) {
        emit('', current, index + 1);
        tableBreak = Boolean(columns?.includes('external'));
      }
      return;
    }
    const line = frame(raw);
    const speaker = transcript && /^(applicant|candidate|interviewer|moderator)\s*:\s*(.*)$/i.exec(line);
    if (speaker && (current !== 'external' || transcriptActive)) {
      current = /^(?:applicant|candidate)$/i.test(speaker[1]) ? 'summary' : 'external';
      transcriptActive = true;
      columns = null;
      emit(speaker[2], current, index + 1, raw.indexOf(':') + 1);
      return;
    }
    const section = headingSection(line), inline = inlineSection(line);
    if (current === 'external' && !columns) {
      if (!personalRecovery(line, section || inline?.section, lines.slice(index + 1, index + 5))) { emit(line, 'external', index + 1); return; }
      current = 'header'; columns = null;
    }
    // Tabs preserve an empty cell on either side of an ownership boundary.
    const cells = (raw.includes('\t') ? raw.split('\t') : line.split(/\s*\|\s*| {2,}/)).map(value => value.trim());
    const headings = cells.map(headingSection);
    if (cells.length === 2 && /^(?:area|category|domain)$/i.test(cells[0])
      && /^(?:practice|skills?|capabilities|tools?|technologies)$/i.test(cells[1])) {
      columns = [null, 'skills']; current = 'skills'; parts.skills ||= []; return;
    }
    if (cells.length > 1 && headings.every(Boolean)) { columns = headings; current = headings[0]; return; }
    if (section) { current = section; columns = null; transcriptActive = false; parts[current] ||= []; return; }
    if (columns && cells.length > 1) {
      let start = 0;
      cells.forEach((cell, column) => {
        if (!cell) return;
        if (columns[column]) emit(cell, columns[column], index + 1, start);
        start = raw.indexOf(cell, start) + cell.length;
      });
      tableBreak = false;
      return;
    }
    if (inline) {
      if (!inline.isolated) { current = inline.section; columns = null; transcriptActive = false; }
      emit(inline.text, inline.section, index + 1, inline.text ? raw.lastIndexOf(inline.text) : 0);
      return;
    }
    if (columns?.includes('external')) {
      if (!tableBreak || !/^(?:I|we)\b/i.test(line) || nonCandidateClause(line)) { emit(line, 'external', index + 1); return; }
      columns = null;
      current = 'header';
    }
    // Unrecognized blocks remain observable to the source-claim classifier, even without a heading.
    emit(line, current, index + 1);
  });
  return { parts, statements };
}

function claimParagraphs(text, statements) {
  const result = [];
  for (const item of statements) {
    const previous = result[result.length - 1];
    // Table cells and heading boundaries are separate contexts. Keep indentation and newlines
    // inside actual wrapped prose so every eventual citation still occurs in the raw source.
    if (previous && previous.section === item.section && previous.line + 1 === item.line
      && /^\s+$/.test(text.slice(previous.end, item.start))) {
      previous.text = text.slice(previous.start, item.end); previous.end = item.end; previous.line = item.line;
    } else result.push({ ...item });
  }
  return result;
}

module.exports = { splitResumeSections, headingSection, inlineSection, claimParagraphs };
