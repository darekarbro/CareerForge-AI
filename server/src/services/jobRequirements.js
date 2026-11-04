const crypto = require('node:crypto');
const { extractSkills, normalizeSkill } = require('../providers/resumeFacts');

const weights = { required_skill: 3, preferred_skill: 1, experience: 2, constraint: 2 };
const instruction = /ignore\s+(?:(?:all|the|any)\s+)?(?:previous|prior|above)|(?:system|assistant)\s*(?:prompt|message|:)|(?:give|return|set|assign)\b.{0,25}\b(?:score|match)\b|pretend\b|override\b.{0,20}\binstructions/i;
const optional = /preferred|nice[ -]to[ -]have|bonus|optional|desirable|a plus/i;
const constraint = /\bremote\b|\bhybrid\b|on[ -]?site|relocat|\btravel\b|\bvisa\b|sponsor|work authori[sz]ation|authori[sz]ed to work|salary|compensation|time[ -]?zone|\bshift\b|\bavailability\b|\bbased in\b|\blocat(?:ion|ed)\b|\bresiden(?:ce|t)\b/i;
const experience = /(?:(?:at least|minimum(?: of)?)\s+)?(\d+(?:\.\d+)?)\s*(?:\+|[-–]\s*\d+)?\s*(?:years?|yrs?)\b/i;
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
    if (/^(?:(?:required|essential|mandatory|minimum|must[ -]have)(?:\s+(?:skills|requirements|qualifications))?|requirements|qualifications)\s*:?$/i.test(line)) { section = 'required_skill'; continue; }
    if (/^(?:(?:preferred|optional|desirable)(?:\s+(?:skills|requirements|qualifications))?|nice[ -]to[ -]have|bonus)\s*:?$/i.test(line)) { section = 'preferred_skill'; continue; }
    if (/^(?:responsibilities|about (?:us|the role)|benefits|what we offer)\s*:?$/i.test(line)) { section = 'context'; continue; }
    // An inline section heading also governs its following semicolon/list clauses.
    // A qualifier elsewhere in prose still applies only to its own clause.
    if (/^(?:(?:required|essential|mandatory|minimum|must[ -]have)(?:\s+(?:skills|requirements|qualifications))?|requirements|qualifications)\s*(?::|[—–-]\s)/i.test(line)) section = 'required_skill';
    else if (/^(?:(?:preferred|optional|desirable)(?:\s+(?:skills|requirements|qualifications))?|nice[ -]to[ -]have|bonus)\s*(?::|[—–-]\s)/i.test(line)) section = 'preferred_skill';
    else if (/^(?:responsibilities|about (?:us|the role)|benefits|what we offer)\s*(?::|[—–-]\s)/i.test(line)) section = 'context';
    // Explicit qualifiers apply to the clause; headings apply to subsequent clauses.
    const category = optional.test(line) ? 'preferred_skill' : /\brequired\b|must[ -]have|mandatory|essential/i.test(line) ? 'required_skill' : section;
    const skills = extractSkills(line), years = line.match(experience), isConstraint = constraint.test(line);
    const ambiguousAlternative = skills.length > 1 && /\bor\b|and\/or/i.test(line);
    if (category !== 'context') for (const skill of skills) add(category, skill, line, ambiguousAlternative ? { ambiguousAlternative: true } : {});
    if (years) add('experience', line, line, { minimumYears: Number(years[1]), scopeSkills: skills, optional: category === 'preferred_skill' });
    else if (/\b(?:senior|junior|entry[ -]level|graduate|experienced|experience (?:with|in)|leadership experience)\b/i.test(line) && !skills.length) add('experience', line, line);
    if (isConstraint) add('constraint', line, line);
    if ((!skills.length && !years && !isConstraint) || category === 'context') result.unclassified.push({ sourceText: line,
      reason: category === 'context' ? 'Context or responsibility retained for manual review.' : 'No dictionary skill or supported requirement pattern recognized; review manually.' });
  }
  // A required occurrence takes precedence over a preferred occurrence of the same skill.
  const required = new Set(result.requiredSkills.map((item) => normalizeSkill(item.label)));
  result.preferredSkills = result.preferredSkills.filter((item) => !required.has(normalizeSkill(item.label)));
  return result;
}
module.exports = { extractRequirements, instruction, weights };
