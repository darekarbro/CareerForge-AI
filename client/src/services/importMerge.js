import { copy, newEntryId, entrySections, sectionLabels } from './resumeTools';
const norm = (value) => String(value || '').normalize('NFKC').trim().toLocaleLowerCase().replace(/\s+/g, ' ');
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const identity = (entry, section) => (section === 'workExperience' ? [entry.role, entry.company, entry.startDate] : section === 'projects' ? [entry.title] : section === 'education' ? [entry.degree, entry.institution, entry.graduationYear] : [entry.name, entry.issuer, entry.year]).map(norm).join('|');
export function importUnits(content, review) {
  const units = [], incoming = review.content;
  const add = (key, label, path, before, after, destination) => {
    if (equal(before, after) || after === '' || after === undefined || Array.isArray(after) && !after.length) return;
    const uncertain = review.issues.some((item) => path.every((part, index) => part === item.path[index]) || item.path.every((part, index) => part === path[index]));
    units.push({ key, label, path, before, after, destination, uncertain });
  };
  for (const [key, value] of Object.entries(incoming.contactInfo || {})) if (key !== '_id') add('contact-' + key, 'Contact / ' + key, ['contactInfo', key], content.contactInfo[key], value, { section: 'contactInfo', field: key });
  add('summary', 'Summary', ['summary'], content.summary, incoming.summary, { section: 'summary' });
  for (const key of ['technical', 'frameworks', 'tools', 'soft']) add('skills-' + key, 'Add ' + key + ' skills', ['skills', key], content.skills[key], incoming.skills?.[key], { section: 'skills', field: key });
  for (const section of entrySections) (incoming[section] || []).forEach((entry, index) => {
    const existing = (content[section] || []).find((item) => identity(item, section) === identity(entry, section));
    const label = sectionLabels[section] + ' / ' + (entry.title || entry.role || entry.degree || entry.name || 'Entry ' + (index + 1));
    if (!existing) add(section + '-' + index, label + ' (new entry)', [section, index], undefined, entry, { section });
    else for (const [key, value] of Object.entries(entry)) if (!['_id', 'entryId'].includes(key)) add(section + '-' + index + '-' + key, label + ' / ' + key, [section, index, key], existing[key], value, { section, id: existing.entryId, field: key });
  });
  return units;
}
export function mergeImport(content, units, selected) {
  const result = copy(content);
  for (const unit of units) {
    if (!selected.includes(unit.key)) continue;
    const { section, field, id } = unit.destination;
    if (section === 'contactInfo') result.contactInfo[field] = unit.after;
    else if (section === 'summary') result.summary = unit.after;
    else if (section === 'skills') result.skills[field] = [...new Map([...result.skills[field], ...unit.after].map((item) => [norm(item), item])).values()];
    else if (id) { const target = result[section].find((item) => item.entryId === id); if (target) target[field] = copy(unit.after); }
    else { const { _id: _unused, entryId: _identity, ...entry } = unit.after; result[section].push({ ...copy(entry), entryId: newEntryId() }); }
  }
  result.skills.all = [...new Set(['technical', 'frameworks', 'tools', 'soft'].flatMap((key) => result.skills[key] || []))];
  return result;
}
