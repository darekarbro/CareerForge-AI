const { plain } = require('../providers/resumeFacts');
const { fail } = require('./resumeContent');
const sectionKeys = ['summary', 'skills', 'workExperience', 'projects', 'education', 'certifications'];
const entrySections = ['workExperience', 'projects', 'education', 'certifications'];
function withEntryIds(value) {
  const content = plain(value);
  for (const section of entrySections) content[section] = (content[section] || []).map((entry, index) => ({ ...entry, entryId: entry.entryId || String(entry._id || 'legacy-' + section + '-' + index) }));
  return content;
}
function presentation(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some((key) => key !== 'sectionOrder')) throw fail('Unsupported resume presentation');
  const order = value.sectionOrder || sectionKeys;
  if (!Array.isArray(order) || order.length !== sectionKeys.length || new Set(order).size !== sectionKeys.length || order.some((key) => !sectionKeys.includes(key))) throw fail('Include each resume section exactly once');
  return { sectionOrder: [...order] };
}
function selection(value, resume) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some((key) => !['workExperience', 'projects'].includes(key))) throw fail('Unsupported resume selection');
  const content = withEntryIds(resume.parsedData), result = {};
  for (const key of ['workExperience', 'projects']) {
    const ids = value[key];
    if (ids === undefined || ids === null) { result[key] = null; continue; }
    const known = new Set(content[key].map((entry) => entry.entryId));
    if (!Array.isArray(ids) || ids.length > 40 || new Set(ids).size !== ids.length || ids.some((id) => typeof id !== 'string' || !known.has(id))) throw Object.assign(fail('The selected resume entries changed. Review the selection before continuing.', 409), { code: 'SELECTION_STALE' });
    result[key] = content[key].filter((entry) => ids.includes(entry.entryId)).map((entry) => entry.entryId);
  }
  return result;
}
function selectedContent(resume, choice) {
  const content = withEntryIds(resume.parsedData), selected = selection(choice, resume);
  for (const key of ['workExperience', 'projects']) if (selected?.[key]) content[key] = content[key].filter((entry) => selected[key].includes(entry.entryId));
  return content;
}
function rewriteScope(value = 'all', content) {
  if (typeof value !== 'string' || value.length > 140) throw fail('Choose a supported rewrite scope');
  if (['all', 'summary'].includes(value)) return value;
  const [section, id, extra] = value.split(':');
  if (extra || !['workExperience', 'projects'].includes(section) || !(content[section] || []).some((entry) => entry.entryId === id)) throw fail('Choose an included experience or project for this rewrite');
  return section + ':' + id;
}
function scopedContent(content, scope = 'all') {
  const source = withEntryIds(content); if (['all', 'summary'].includes(scope)) return source;
  const [section, id] = scope.split(':'); return { ...source, summary: '', workExperience: [], projects: [], [section]: source[section].filter((entry) => entry.entryId === id) };
}
module.exports = { sectionKeys, entrySections, withEntryIds, presentation, selection, selectedContent, rewriteScope, scopedContent };
