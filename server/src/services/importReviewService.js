const { withEntryIds } = require('./resumeStructure');
const normalize = (value) => String(value || '').normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
async function review(id, owner) {
  const resume = await require('./resumeService').getReadyResume(id, owner);
  let source = resume.sourceText || '', label = 'Text extracted from the original file', available = Boolean(resume.originalFileStorage?.provider || resume.originalFileName);
  if (!source && available) {
    try { source = await require('../agents/parserAgent').extractTextFromBuffer(await require('../config/cloudinary').readOriginal(resume), resume.fileType); }
    catch { available = false; label = 'Saved resume text — original file unavailable'; }
  }
  if (!source) { source = resume.rawText || ''; label = available ? label : resume.sourceType === 'profile' ? 'Verified career profile text' : 'Saved resume text — original file unavailable'; }
  const content = withEntryIds(resume.parsedData), issues = [], normalized = normalize(source);
  const walk = (value, path) => {
    if (typeof value === 'string' && value.trim() && !['entryId', '_id'].includes(path.at(-1)) && !normalized.includes(normalize(value))) issues.push({ path, reason: 'Not found verbatim in the source. Confirm that the extracted wording is accurate.' });
    else if (Array.isArray(value)) value.forEach((item, index) => walk(item, [...path, index]));
    else if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) if (!['entryId', '_id', 'aiProvider', 'warnings'].includes(key)) walk(item, [...path, key]);
  };
  walk(content, []);
  for (const key of ['name', 'email']) if (!content.contactInfo?.[key]) issues.push({ path: ['contactInfo', key], reason: 'This contact field was not extracted. Add it if appropriate.' });
  return { resumeId: resume._id, title: resume.title, fileType: resume.fileType, sourceText: source, sourceLabel: label, originalAvailable: available, content, issues, warnings: resume.parsingWarnings || [], verifiedAt: resume.verifiedAt || null };
}
module.exports = { review };
