const { normalizeSkill } = require('../providers/resumeFacts');
const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const object = (value, label) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw fail(label + ' must be an object');
  return value;
};
function text(value, label, max = 250) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string' || value.length > max) throw fail(label + ' must be text of at most ' + max + ' characters');
  return value.trim();
}
function list(value, label, max = 60, itemMax = 1800) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > max) throw fail(label + ' contains too many entries');
  return value.map((item) => text(item, label, itemMax)).filter(Boolean);
}
function url(value, label) {
  const result = text(value, label, 2048);
  if (!result) return '';
  let parsed;
  try { parsed = new URL(/^https?:\/\//i.test(result) ? result : 'https://' + result); }
  catch { throw fail(label + ' must be a valid web address'); }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || !parsed.hostname.includes('.')) throw fail(label + ' must be an HTTP or HTTPS address');
  return parsed.href;
}
const contactKeys = ['name', 'email', 'phone', 'location', 'linkedin', 'github', 'portfolio'];
const groupKeys = ['technical', 'frameworks', 'tools', 'soft', 'all'];
function cleanResumeContent(value) {
  const input = object(value, 'Resume content');
  const allowed = new Set(['contactInfo', 'summary', 'skills', 'workExperience', 'projects', 'education', 'certifications', '_id']);
  if (Object.keys(input).some((key) => !allowed.has(key))) throw fail('Unsupported resume field');
  const contact = input.contactInfo === undefined ? {} : object(input.contactInfo, 'Contact details');
  if (Object.keys(contact).some((key) => !contactKeys.includes(key) && key !== '_id')) throw fail('Unsupported contact field');
  const contactInfo = Object.fromEntries(contactKeys.map((key) => [key,
    ['linkedin', 'github', 'portfolio'].includes(key) ? url(contact[key], key) : text(contact[key], key, 300)]));
  if (contactInfo.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactInfo.email)) throw fail('Enter a valid contact email');
  const skillInput = input.skills === undefined ? {} : object(input.skills, 'Skills');
  const skills = Object.fromEntries(groupKeys.map((key) => [key, list(skillInput[key], key + ' skills', 150, 120)]));
  skills.all = [...new Map(Object.values(skills).flat().map((skill) => [normalizeSkill(skill), skill])).values()];
  const records = (key, fields) => {
    const entries = input[key] || [];
    if (!Array.isArray(entries) || entries.length > 40) throw fail(key + ' may contain at most 40 records');
    return entries.map((item, index) => {
      const entry = object(item, key + ' ' + (index + 1));
      const keys = new Set([...fields, '_id', 'entryId']);
      if (Object.keys(entry).some((field) => !keys.has(field))) throw fail('Unsupported ' + key + ' field');
      const record = Object.fromEntries(fields.map((field) => {
        if (field === 'highlights') return [field, list(entry[field], key + ' bullets', 50)];
        if (field === 'technologies') return [field, list(entry[field], 'Technologies', 100, 120)];
        if (field === 'current') {
          if (entry.current !== undefined && typeof entry.current !== 'boolean') throw fail('Current role must be true or false');
          return [field, Boolean(entry.current)];
        }
        return [field, field === 'link' ? url(entry[field], 'Project link') : text(entry[field], field, field === 'description' ? 4000 : 300)];
      }));
      record.entryId = entry.entryId || String(entry._id || 'legacy-' + key + '-' + index);
      if (!/^[a-zA-Z0-9_-]{1,100}$/.test(record.entryId) || ['__proto__', 'constructor', 'prototype'].includes(record.entryId)) throw fail('Invalid entry identity');
      return record;
    });
  };
  const content = { contactInfo, summary: text(input.summary, 'Summary', 6000), skills,
    workExperience: records('workExperience', ['role', 'company', 'location', 'startDate', 'endDate', 'current', 'highlights']),
    projects: records('projects', ['title', 'description', 'technologies', 'link', 'highlights']),
    education: records('education', ['degree', 'institution', 'fieldOfStudy', 'graduationYear', 'score']),
    certifications: records('certifications', ['name', 'issuer', 'year']) };
  for (const key of ['workExperience', 'projects', 'education', 'certifications']) if (new Set(content[key].map((entry) => entry.entryId)).size !== content[key].length) throw fail('Each entry needs a unique identity');
  for (const entry of content.workExperience) {
    const start = datePoint(entry.startDate), end = entry.current ? null : datePoint(entry.endDate, true);
    if (entry.current && entry.endDate && !/^(present|current|now)$/i.test(entry.endDate)) throw fail('Clear the end date for a current role');
    if (start && end && start > end) throw fail('Experience start date must be before its end date');
  }
  for (const entry of [...content.education.map((item) => ({ value: item.graduationYear, label: 'Graduation year' })), ...content.certifications.map((item) => ({ value: item.year, label: 'Certificate year' }))]) {
    if (entry.value && (!/^\d{4}$/.test(entry.value) || Number(entry.value) < 1900 || Number(entry.value) > new Date().getUTCFullYear() + 15)) throw fail(entry.label + ' must be a valid four-digit year');
  }
  if (JSON.stringify(content).length > 48000) throw fail('Resume content must fit within 48,000 characters');
  return content;
}
function datePoint(value, end = false) {
  if (!value || /^(present|current|now)$/i.test(value)) return null;
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  let year, month;
  if (/^\d{4}(?:-\d{2})?$/.test(value)) { const parts = value.split('-'); year = Number(parts[0]); month = parts[1] ? Number(parts[1]) : end ? 12 : 1; }
  else { const match = value.match(/^([a-z]+)\s+(\d{4})$/i); if (match) { year = Number(match[2]); month = months.indexOf(match[1].slice(0, 3).toLowerCase()) + 1; } }
  if (!year || year < 1900 || year > new Date().getUTCFullYear() + 15 || !month || month > 12) throw fail('Use YYYY, YYYY-MM or Month YYYY for experience dates');
  return year * 12 + month;
}
function revision(value) {
  if (!Number.isInteger(value) || value < 0) throw fail('A valid revision number is required');
  return value;
}
module.exports = { cleanResumeContent, revision, text, url, fail, datePoint };
