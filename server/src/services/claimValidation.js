const { extractSkills, hasSkill, resumeText } = require('../providers/resumeFacts');
const wordNumbers = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
const normalizeNumbers = (value) => {
  const zeros = [0x660, 0x6f0, 0x966, 0x9e6];
  const normalized = [...String(value || '').normalize('NFKC')].map((char) => { const code = char.codePointAt(0), zero = zeros.find((base) => code >= base && code <= base + 9); return zero === undefined ? char : String(code - zero); }).join('').replace(/\p{Pd}/gu, '-')
    .replace(/\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b/g, (number) => number.replace(/,/g, ''))
    .replace(/(\d),(\d{1,2})(?!\d)/g, '$1.$2')
    .replace(new RegExp('\\b(' + wordNumbers.join('|') + ')\\b', 'gi'), (word) => String(wordNumbers.indexOf(word.toLowerCase())));
  return normalized;
};
const quantities = (value) => [...new Set(normalizeNumbers(value).match(/\p{Nd}+(?:\.\p{Nd}+)?/gu) || [])];
const bindings = (value) => [...normalizeNumbers(value).matchAll(/(\p{Nd}+(?:\.\p{Nd}+)?)\s*[- ]?\s*(%|users?\b|developers?\b|engineers?\b|customers?\b|records?\b|rows?\b|requests?\b|tests?\b|services?\b|projects?\b|teams?\b|people\b|persons?\b|milliseconds?\b|ms\b|seconds?\b|minutes?\b|hours?\b)/giu)].map((match) => ({ number: match[1], unit: match[2].toLowerCase().replace(/s$/, '').replace(/^millisecond$|^m$/, 'ms') }));
const responsibilities = [
  { name: 'leadership or management', written: /\b(?:led|managed|supervised|mentored|hired|directed)\b/i, source: /\b(?:led|lead|leader|managed|management|supervised|mentored|hired|directed)\b/i },
  { name: 'ownership or architecture', written: /\b(?:architected|owned|spearheaded)\b/i, source: /\b(?:architect|architecture|architected|owned|ownership|spearheaded)\b/i },
  { name: 'production deployment', written: /\b(?:deployed|launched|production)\b/i, source: /\b(?:deploy|deployment|deployed|launched|production)\b/i },
  { name: 'measured improvement', written: /\b(?:increased|reduced|improved|saved)\b.{0,60}\d|\d.{0,40}\b(?:increase|reduction|faster)\b/i, source: /\b(?:increas\w*|reduc\w*|improv\w*|sav\w*|faster)\b/i },
];
function issues(statement, sourceText, { technologies = [] } = {}) {
  const found = [], actual = new Set(quantities(sourceText));
  for (const number of quantities(statement)) if (!actual.has(number)) found.push('Number ' + number + ' is not supported by this experience/project.');
  const supportedBindings = bindings(sourceText);
  for (const binding of bindings(statement)) if (actual.has(binding.number) && !supportedBindings.some((item) => item.number === binding.number && item.unit === binding.unit)) found.push('The quantity ' + binding.number + ' ' + binding.unit + ' is not established by this entry.');
  const methods = ['JWT', 'OAuth', 'RBAC', 'middleware', 'caching', 'indexing'];
  for (const skill of [...new Set([...extractSkills(statement), ...methods.filter((method) => hasSkill(statement, method))])]) if (!hasSkill(sourceText, skill) && !technologies.some((item) => hasSkill(item, skill)) && !(skill === 'Data Pipelines' && /data\s+(?:import|processing)\s+(?:tools?|utilities|workflows?)/i.test(sourceText))) found.push(skill + ' is not supported by this experience/project.');
  for (const [method, pattern] of [['indexing', /\bindex(?:es|ed|ing)?\b/i], ['caching', /\bcach(?:e|es|ed|ing)\b/i]]) if (pattern.test(statement) && !pattern.test(sourceText) && !technologies.some((item) => pattern.test(item))) found.push('The ' + method + ' mechanism is not established by this entry.');
  for (const responsibility of responsibilities) if (responsibility.written.test(statement) && !responsibility.source.test(sourceText)) found.push('The claimed ' + responsibility.name + ' is not established by this entry.');
  return found;
}
const entryText = (entry) => resumeText({ description: entry.description || '', highlights: entry.highlights || [], technologies: entry.technologies || [] });
module.exports = { quantities, issues, entryText };
