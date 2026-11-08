const crypto = require('node:crypto');
const { extractSkills, normalizeSkill } = require('../providers/resumeFacts');

const weights = { required_skill: 3, preferred_skill: 1, experience: 2, constraint: 2 };
const instruction = /ignore\s+(?:(?:all|the|any)\s+)?(?:previous|prior|above)|(?:system|assistant)\s*(?:prompt|message|:)|(?:give|return|set|assign)\b.{0,25}\b(?:score|match)\b|pretend\b|override\b.{0,20}\binstructions/i;
const optional = /preferred|nice[ -]to[ -]have|bonus|optional|desirable|a plus/i;
const constraint = /\bremote\b|\bhybrid\b|on[ -]?site|relocat|\btravel\b|\bvisa\b|sponsor|work authori[sz]ation|authori[sz]ed to work|salary|compensation|time[ -]?zone|\bshifts?\b|\bavailability\b|\bbased in\b|\blocat(?:ion|ed)\b|\bresiden(?:ce|t)\b|\b(?:utc|gmt)\s*[+-]\s*\d{1,2}\b|\b(?:driving|driver['’]?s?)\s+licen[cs]e\b/i;
const duration = /\b(\d+(?:\.\d+)?)\s*(?:\+|(?:[-–—]|to)\s*\d+(?:\.\d+)?)?\s*(years?|yrs?|months?|mos?)\b/gi;
const experienceNoun = /^(?:of\s+)?(?:(?:relevant|professional|commercial|practical|hands[- ]on)\s+)*(?:experience|practice|work)\b/i;
const durationActivity = /^(?:building|developing|delivering|maintaining|managing|operating|supporting|working|using)\s+.+/i;
const qualitativeExperience = /\b(?:senior|junior|entry[ -]level|graduate|experienced|leadership experience|experience\s+(?:with|in|managing|leading|delivering|supporting|operating|building|developing|working))\b/i;
const headings = [
  ['required_skill', /^(?:(?:required|essential|mandatory|minimum|must[ -]have)(?:\s+(?:skills|requirements|qualifications))?|requirements|qualifications)$/i],
  ['preferred_skill', /^(?:(?:preferred|optional|desirable)(?:\s+(?:skills|requirements|qualifications))?|nice[ -]to[ -]have|bonus)$/i],
  ['context', /^(?:responsibilities|about (?:us|the role))$/i],
  ['benefits', /^(?:benefits|what we offer)$/i],
];

function requirementHeading(line) {
  const separated = line.match(/^\[([^\[\]]+)\]\s*:?\s*(.*)$/) || line.match(/^(.+?)(?::|\s+[—–-](?:\s+|$))\s*(.*)$/);
  const label = (separated?.[1] || line).trim();
  const category = headings.find(([, pattern]) => pattern.test(label))?.[0];
  return category ? { category, hasContent: Boolean(separated?.[2].trim()) } : null;
}

function durationScope(prefix, suffix) {
  // Read the phrase directly tied to the duration before considering later activity.
  const afterNoun = suffix.replace(experienceNoun, '').trim();
  let scope = afterNoun.match(/^(?:of|with|in|on|using|as)\s+(.+)/i)?.[1] || afterNoun.match(durationActivity)?.[0]
    || afterNoun.match(/^(.+?)\s+experience\b/i)?.[1] || '';
  if (!scope && afterNoun) {
    const list = afterNoun.replace(/[.!?]$/, '').split(/\s*(?:,|\band\b|\bor\b|&)\s*/i);
    if (list.every(label => extractSkills(label).some(skill => normalizeSkill(skill) === normalizeSkill(label)))) scope = afterNoun;
  }
  if (!scope && !experienceNoun.test(suffix) && /(?:\bfor|:)$/i.test(prefix)) {
    scope = prefix.replace(/(?:\s+for|:)$/i, '')
      .replace(/^(?:(?:i|we)\s+)?(?:(?:have|had|personally)\s+)*(?:worked|used|built|developed|managed|maintained|served|operated)\s+(?:(?:with|in|on|using|as)\s+)?/i, '');
  }
  return scope.split(/[,;]|[.!?](?=\s|$)|\s+(?:experience|practice|is\s+required|are\s+required|required|preferred|a\s+plus|delivering|developing|maintaining|building|managing|operating|working)\b|\s+(?:and|then)\s+(?:(?:also|only|briefly|occasionally|recently|previously|currently|i|we)\s+)*(?:used|worked|implemented|built|designed|developed|managed|maintained|deployed|learned|am|have)\b/i)[0].trim();
}

function experienceDurations(text) {
  const source = String(text ?? '');
  const matches = [...source.matchAll(duration)];
  const boundaries = matches.slice(1).map((match, index) => {
    const previousEnd = matches[index].index + matches[index][0].length;
    const between = source.slice(previousEnd, match.index);
    const connector = [...between.matchAll(/,\s*|\s+(?:and|or|plus)\s+/gi)].at(-1);
    const end = connector ? previousEnd + connector.index : match.index;
    return { end, start: end + (connector?.[0].length || 0) };
  });
  return matches.map((match, index) => {
    const start = boundaries[index - 1]?.start ?? 0, end = boundaries[index]?.end ?? source.length;
    const prefix = source.slice(start, match.index).trim(), suffix = source.slice(match.index + match[0].length, end).trim();
    return {
      sourceText: source.slice(start, end).trim(), prefix,
      years: Number(match[1]) / (/^mo/i.test(match[2]) ? 12 : 1),
      scope: durationScope(prefix, suffix), generalExperience: experienceNoun.test(suffix),
      approximateOrUpperBound: /(?:\b(?:at most|less than|fewer than|under|up to|no more than|nearly|almost|about|around|approximately)|<)\s*$/i.test(prefix) || /^(?:or less|maximum)\b/i.test(suffix),
    };
  });
}
function extractRequirements(text = '') {
  const result = { requiredSkills: [], preferredSkills: [], experience: [], constraints: [], unclassified: [] };
  const seen = new Set(); let section = 'required_skill';
  const add = (category, label, sourceText, extra = {}) => {
    const key = category + ':' + (/_skill$/.test(category) ? normalizeSkill(label) : label.toLowerCase());
    if (seen.has(key)) return; seen.add(key);
    const item = { id: 'req-' + crypto.createHash('sha256').update(key).digest('hex').slice(0, 12), category, label, sourceText, weight: weights[category], ...extra };
    result[{ required_skill: 'requiredSkills', preferred_skill: 'preferredSkills', experience: 'experience', constraint: 'constraints' }[category]].push(item);
  };
  for (const raw of String(text).split(/\r?\n|;|\.\s+(?=[A-Z])/)) {
    const line = raw.trim().replace(/^[•*\-]\s*/, '').trim(); if (!line) continue;
    if (instruction.test(line)) { result.unclassified.push({ sourceText: line, reason: 'Instruction-like source text was excluded from assessment.' }); continue; }
    const heading = requirementHeading(line);
    if (heading) {
      section = heading.category;
      if (!heading.hasContent) continue;
    }
    if (section === 'benefits') {
      result.unclassified.push({ sourceText: line, reason: 'Employer benefit retained for manual review.' });
      continue;
    }
    // Explicit qualifiers apply to the clause; headings apply to subsequent clauses.
    const category = optional.test(line) ? 'preferred_skill' : /\brequired\b|must[ -]have|mandatory|essential/i.test(line) ? 'required_skill' : section;
    const skills = extractSkills(line), durations = experienceDurations(line), isConstraint = constraint.test(line);
    const ambiguousAlternative = skills.length > 1 && /\bor\b|and\/or/i.test(line);
    if (category !== 'context') for (const skill of skills) add(category, skill, line, ambiguousAlternative ? { ambiguousAlternative: true } : {});
    for (const item of durations) {
      add('experience', item.sourceText, item.sourceText, item.approximateOrUpperBound ? {} : {
        minimumYears: item.years, scopeSkills: extractSkills(item.scope), optional: category === 'preferred_skill',
      });
    }
    if (!durations.length && qualitativeExperience.test(line) && !skills.length) add('experience', line, line);
    if (isConstraint) add('constraint', line, line);
    if ((!skills.length && !durations.length && !isConstraint) || category === 'context') result.unclassified.push({ sourceText: line,
      reason: category === 'context' ? 'Context or responsibility retained for manual review.' : 'No dictionary skill or supported requirement pattern recognized; review manually.' });
  }
  // A required occurrence takes precedence over a preferred occurrence of the same skill.
  const required = new Set(result.requiredSkills.map((item) => normalizeSkill(item.label)));
  result.preferredSkills = result.preferredSkills.filter((item) => !required.has(normalizeSkill(item.label)));
  return result;
}
module.exports = { extractRequirements, experienceDurations, instruction, weights };
