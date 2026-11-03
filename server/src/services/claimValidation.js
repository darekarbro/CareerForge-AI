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
// This is a bounded lexical check, not an entailment model. A contribution or
// intended benefit is not evidence that an improvement actually happened.
const outcomePatterns = [
  ['reduction', /\b(?:reduc(?:e[ds]?|ing|tion)|decreas(?:e[ds]?|ing)|lower(?:ed|ing|s)?|minimi[sz](?:e[ds]?|ing)|sav(?:e[ds]?|ing)|fewer)\b/gi],
  ['elimination', /\beliminat(?:e[ds]?|ing)\b/gi],
  ['prevention', /\bprevent(?:ed|ing|s)?\b/gi],
  ['improvement', /\b(?:improv(?:e[ds]?|ing|ements?)|enhanc(?:e[ds]?|ing))\b/gi],
  ['increase', /\b(?:boost(?:ed|ing|s)?|increas(?:e[ds]?|ing)|rais(?:e[ds]?|ing))\b/gi],
  ['efficiency', /\b(?:streamlin(?:e[ds]?|ing)|accelerat(?:e[ds]?|ing)|optimi[sz](?:e[ds]?|ing)|simplif(?:y|ies|ied|ying)|expedit(?:e[ds]?|ing)|faster)\b/gi],
  ['assurance', /\b(?:ensur(?:e[ds]?|ing)|guarantee(?:d|s|ing)?)\b/gi],
];
const outcomeNoise = new Set(('a an the this that these those its their our my your of in for on at and or as was were is are has have had been being more less significantly substantially successfully overall resulting result results solution system application platform project tool process workflow data outcome outcomes effect effects gain gains improvement improvements i we it developed implemented built documented generated').split(' '));
function outcomes(value) {
  const text = String(value || '').normalize('NFKC').toLowerCase(), result = [];
  for (const clause of text.split(/[.!?;\n]|\b(?:but|whereas|although)\b/)) {
    const matches = outcomePatterns.flatMap(([family, pattern]) => [...clause.matchAll(pattern)].map((match) => ({ family, index: match.index, end: match.index + match[0].length }))).sort((a, b) => a.index - b.index);
    for (let index = 0; index < matches.length; index++) {
      const match = matches[index], before = clause.slice(0, match.index), after = clause.slice(match.end, matches[index + 1]?.index).slice(0, 160);
      // Denials, uncertain outcomes, future claims and purpose clauses do not
      // establish an observed result, even if they contain the same verb.
      if (/\b(?:not|never|no|without|unable|failed|unknown|unverified|unconfirmed)\b|n['’]t\b/.test(before.slice(-100)) ||
          /\b(?:to|can|could|may|might|would|should|will)\s+(?:\w+\s+){0,3}$/.test(before) ||
          /\b(?:aim(?:ed|s)?|intend(?:ed|s)?|plan(?:ned|s)?|goal|designed|expected|hope(?:d|s)?|potential)\b/.test(before) ||
          /\b(?:unknown|unverified|unconfirmed)\b|\bnot\s+(?:known|verified|confirmed|established|measured)\b|^\s+(?:no|neither)\b|\bno\s+evidence\b/.test(after)) continue;
      const object = after.split(/\b(?:by|with|using|through|via|after|before|because|while|resulting|leading|allowing|enabling)\b/)[0];
      const targets = [...new Set((object.match(/[a-z]+/g) || []).filter((word) => word.length > 2 && !outcomeNoise.has(word)).map((word) => word.replace(/(?:ing|ed|s)$/, '')))];
      result.push({ family: match.family, targets, phrase: clause.slice(match.index, match.end + object.length).trim().slice(0, 100) });
    }
  }
  return result;
}
function outcomeIssues(statement, sourceText) {
  const supported = outcomes(sourceText);
  return outcomes(statement).filter((claim) => !claim.targets.length || !supported.some((fact) => fact.family === claim.family && claim.targets.every((target) => fact.targets.includes(target))))
    .map((claim) => 'The claimed outcome ("' + claim.phrase + '") is not established by this entry.');
}
function issues(statement, sourceText, { technologies = [] } = {}) {
  const found = [], actual = new Set(quantities(sourceText));
  for (const number of quantities(statement)) if (!actual.has(number)) found.push('Number ' + number + ' is not supported by this experience/project.');
  const supportedBindings = bindings(sourceText);
  for (const binding of bindings(statement)) if (actual.has(binding.number) && !supportedBindings.some((item) => item.number === binding.number && item.unit === binding.unit)) found.push('The quantity ' + binding.number + ' ' + binding.unit + ' is not established by this entry.');
  const methods = ['JWT', 'OAuth', 'RBAC', 'middleware', 'caching', 'indexing'];
  for (const skill of [...new Set([...extractSkills(statement), ...methods.filter((method) => hasSkill(statement, method))])]) if (!hasSkill(sourceText, skill) && !technologies.some((item) => hasSkill(item, skill)) && !(skill === 'Data Pipelines' && /data\s+(?:import|processing)\s+(?:tools?|utilities|workflows?)/i.test(sourceText))) found.push(skill + ' is not supported by this experience/project.');
  for (const [method, pattern] of [['indexing', /\bindex(?:es|ed|ing)?\b/i], ['caching', /\bcach(?:e|es|ed|ing)\b/i]]) if (pattern.test(statement) && !pattern.test(sourceText) && !technologies.some((item) => pattern.test(item))) found.push('The ' + method + ' mechanism is not established by this entry.');
  for (const responsibility of responsibilities) if (responsibility.written.test(statement) && !responsibility.source.test(sourceText)) found.push('The claimed ' + responsibility.name + ' is not established by this entry.');
  found.push(...outcomeIssues(statement, sourceText));
  return found;
}
const entryText = (entry) => resumeText({ description: entry.description || '', highlights: entry.highlights || [], technologies: entry.technologies || [] });
module.exports = { quantities, issues, outcomeIssues, entryText };
