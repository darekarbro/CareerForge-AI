const { hasSkill, normalizeSkill } = require('./resumeFacts');
const { instruction } = require('../services/jobRequirements');

const denialPrefixes = [
  /\b(?:(?:do|does|did)\s+not|(?:don|doesn|didn)['’]t)\s+(?:know|use|understand)\s+/gi,
  /\b(?:(?:do|does|did)\s+not|(?:don|doesn|didn)['’]t)\s+have\s+(?:any\s+)?(?:experience|knowledge|proficiency)\s+(?:with|in|of)\s+/gi,
  /\bnever\s+(?:used|worked\s+with|worked\s+on)\s+/gi,
  /\bno\s+(?:(?:prior|professional|practical|hands-on)\s+)?(?:experience|knowledge|proficiency)\s+(?:with|in|of)\s+/gi,
  /\bnot\s+(?:yet\s+)?(?:familiar|proficient|experienced)\s+(?:with|in)\s+/gi,
];

function startsWithSkill(value, skill) {
  const candidate = value.trim().replace(/^(?:any|the)\s+/i, '');
  const key = normalizeSkill(skill);
  // Compare the complete canonical/alias name, rather than a substring such as React in ReactNative.
  for (let length = Math.min(candidate.length, 80); length > 0; length--) {
    const prefix = candidate.slice(0, length);
    if (normalizeSkill(prefix) !== key || !hasSkill(prefix, skill)) continue;
    const rest = candidate.slice(length);
    if (!rest || /^[.!?)\]](?:\s|$)/.test(rest)
      || /^\s+(?:at\s+all\b|well\b|yet\b|before\b|currently\b|professionally\b|in\b|on\b|for\b|as\b)/i.test(rest)) return true;
  }
  return false;
}

function deniedListContains(value, skill) {
  // A new verb after "and" is not a listed skill: startsWithSkill rejects that fragment.
  return value.split(/\s*(?:,|\band\b|\bor\b|\bnor\b)\s*/i).some((part) => startsWithSkill(part, skill));
}

function explicitlyDeniesSkill(text, skill) {
  if (typeof skill !== 'string' || !skill.trim()) return false;
  for (const line of String(text ?? '').split(/\r?\n/)) {
    if (instruction.test(line)) continue;
    // Keep punctuation-bearing names (Node.js, .NET) intact while bounding denial to its clause.
    const clauses = line.split(/[;!?]|\.(?=\s|$)|\b(?:but|however|whereas|although|while)\b/i);
    for (const clause of clauses) {
      for (const prefix of denialPrefixes) {
        for (const match of clause.matchAll(prefix)) {
          if (deniedListContains(clause.slice(match.index + match[0].length), skill)) return true;
        }
      }
      for (const match of clause.matchAll(/\bno\s+(.+?)\s+(?:experience|knowledge|proficiency)\b/gi)) {
        if (deniedListContains(match[1], skill)) return true;
      }
      for (const match of clause.matchAll(/(?:^|,)\s*(.+?)\s+(?:is|are)\s+not\s+(?:(?:among|one\s+of)\s+my\s+skills|a\s+skill\s+I\s+have)\b/gi)) {
        if (deniedListContains(match[1], skill)) return true;
      }
    }
  }
  return false;
}

module.exports = { explicitlyDeniesSkill };
