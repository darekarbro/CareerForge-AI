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
      const keys = new Set([...fields, '_id']);
      if (Object.keys(entry).some((field) => !keys.has(field))) throw fail('Unsupported ' + key + ' field');
      return Object.fromEntries(fields.map((field) => {
        if (field === 'highlights') return [field, list(entry[field], key + ' bullets', 50)];
        if (field === 'technologies') return [field, list(entry[field], 'Technologies', 100, 120)];
        if (field === 'current') {
          if (entry.current !== undefined && typeof entry.current !== 'boolean') throw fail('Current role must be true or false');
          return [field, Boolean(entry.current)];
        }
        return [field, field === 'link' ? url(entry[field], 'Project link') : text(entry[field], field, field === 'description' ? 4000 : 300)];
      }));
    });
  };
  const content = { contactInfo, summary: text(input.summary, 'Summary', 6000), skills,
    workExperience: records('workExperience', ['role', 'company', 'location', 'startDate', 'endDate', 'current', 'highlights']),
    projects: records('projects', ['title', 'description', 'technologies', 'link', 'highlights']),
    education: records('education', ['degree', 'institution', 'fieldOfStudy', 'graduationYear', 'score']),
    certifications: records('certifications', ['name', 'issuer', 'year']) };
  if (JSON.stringify(content).length > 48000) throw fail('Resume content must fit within 48,000 characters');
  return content;
}
function revision(value) {
  if (!Number.isInteger(value) || value < 0) throw fail('A valid revision number is required');
  return value;
}
module.exports = { cleanResumeContent, revision, text, url, fail };
