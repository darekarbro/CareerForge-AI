const { hasSkill, normalizeSkill } = require('./resumeFacts');
const { instruction } = require('../services/jobRequirements');
const action = 'know|use|understand|learn|study|operate|program';
const coordinatedAction = action + '|used|understood|learned|learnt|studied|operated|programmed|worked\\s+with';
const otherRole = '(?:colleague|teammate|team|manager|client|customer|student|applicant|recruiter|partner|friend)';
const otherAction = '(?:uses?|used|builds?|built|writes?|wrote|knows?|works?|worked|said|says|does\\s+not|doesn[\'’]t|cannot|can[\'’]t|has|have)';
const namedOwner = '(?!I\\b|We\\b|My\\b|Our\\b|No\\b|Not\\b|This\\b|The\\b|A\\b|An\\b|Candidate\\b)(?:[A-Z][a-z]+|[A-Z]{2,})(?:\\s+(?:[A-Z][a-z]+|[A-Z]{2,}))?\\s+' + otherAction + '\\b';
const isNamedOwner = value => !/^(?:I|we|my|our|no|not|this|the|a|an|candidate)\b/i.test(value) && new RegExp('^' + namedOwner).test(value);

const denialPrefixes = [
  new RegExp("\\b(?:(?:do|does|did)\\s+not|(?:don|doesn|didn)['’]t)\\s+(?:" + action + ')(?:\\s+or\\s+(?:' + action + '))*\\s+', 'gi'),
  /\b(?:(?:do|does|did)\s+not|(?:don|doesn|didn)['’]t)\s+(?:have|possess)\s+(?:any\s+)?(?:(?:experience|knowledge|proficiency)\s+(?:with|in|of)\s+)?/gi,
  /\b(?:cannot|can['’]t|could\s+not|couldn['’]t)\s+(?:use|understand|operate|program(?:\s+in)?|work\s+(?:with|in)|build(?:\s+anything)?\s+(?:with|using))\s+/gi,
  /\b(?:never|have\s+not|haven['’]t|had\s+not|hadn['’]t)\s+(?:used|learned|learnt|studied|worked\s+(?:with|on|in))\s+/gi,
  /\b(?:lack|lacking)\s+(?:(?:experience|knowledge|proficiency)\s+(?:with|in|of)\s+)?/gi,
  /\b(?:(?:do|does|did)\s+not|(?:don|doesn|didn)['’]t)\s+(?:know|use|understand)\s+/gi,
  /\b(?:(?:do|does|did)\s+not|(?:don|doesn|didn)['’]t)\s+have\s+(?:any\s+)?(?:experience|knowledge|proficiency)\s+(?:with|in|of)\s+/gi,
  /\bnever\s+(?:used|worked\s+with|worked\s+on)\s+/gi,
  /\bno\s+(?:(?:prior|professional|practical|hands-on)\s+)?(?:skills?|experience|knowledge|proficiency)\s+(?:with|in|of)\s+/gi,
  /\bno\s+ability\s+to\s+(?:use|understand|operate|program(?:\s+in)?|work\s+(?:with|in)|build\s+(?:with|using))\s+/gi,
  /\bnot\s+(?:yet\s+)?(?:familiar|proficient|experienced|skilled)\s+(?:with|in)\s+/gi,
];

function splitClaimClauses(text) {
  const source = String(text ?? ''), protectedAt = new Uint8Array(source.length);
  let quoteStart = -1, quoteEnd;
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (char === "'" && /[\p{L}\p{N}]/u.test(source[index - 1] || '') && /[\p{L}\p{N}]/u.test(source[index + 1] || '')) continue;
    if (quoteStart < 0 && /["'“‘]/.test(char)) { quoteStart = index; quoteEnd = ({ '“': '”', '‘': '’' })[char] || char; }
    else if (quoteStart >= 0 && char === quoteEnd) { protectedAt.fill(1, quoteStart, index + 1); quoteStart = -1; }
  }
  if (quoteStart >= 0) protectedAt.fill(1, quoteStart);
  // A quoted first-person sentence keeps the owner in its introducing clause.
  // Likewise, every fragment of an instruction-bearing physical line is excluded.
  let lineStart = 0;
  for (const line of source.split(/\r?\n/)) {
    if (instruction.test(line)) protectedAt.fill(2, lineStart, lineStart + line.length);
    lineStart += line.length + (source.slice(lineStart + line.length, lineStart + line.length + 2) === '\r\n' ? 2 : 1);
  }
  const separator = new RegExp('\\r?\\n|(?<=[.!?;])\\s+|(?<=[.!?][\'"’”])\\s+|\\b(?:but|however|whereas|although|while)\\b|(?=\\b(?:and\\s+)?(?:(?:I|we)\\b|(?:my|our|the|a)\\s+' + otherRole + '\\b|(?:he|she|they)\\s+' + otherAction + '|' + namedOwner + '))', 'gi');
  const clauses = [];
  let start = 0;
  const append = end => {
    const raw = source.slice(start, end).trim();
    if (raw && !protectedAt.subarray(start, end).includes(2)) clauses.push(raw);
  };
  for (const match of source.matchAll(separator)) {
    if (protectedAt[match.index]) continue;
    if (!match[0]) {
      const subject = source.slice(match.index).replace(/^and\s+/i, '');
      const knownSubject = /^(?:I|we|he|she|they)\b/i.test(subject)
        || new RegExp('^(?:my|our|the|a)\\s+' + otherRole + '\\b', 'i').test(subject)
        || isNamedOwner(subject);
      if (!knownSubject) continue;
    }
    if (/^\r?\n$/.test(match[0])) {
      const before = source.slice(start, match.index).trimEnd(), after = source.slice(match.index + match[0].length).trimStart();
      const unfinished = !/[.!?;:]$/.test(before);
      const candidateLead = /\b(?:I|we|my|our)\b/i.test(before)
        || /^(?:Built|Implemented|Wrote|Developed|Created|Maintained|Designed|Reviewed)\b/i.test(before)
        || /\b(?:experience|skills?|proficiency)\s+(?:from|through)\b/i.test(before);
      if (unfinished && (/\b(?:use|using|with|in|and|or)\s*$/i.test(before)
        || /^(?:a|an|the|and|also|using|with|in|on|from|through|via|by|including|which|that)\b/i.test(after) && candidateLead)) continue;
    }
    // A subject inside its own sentence is not an ownership transition.
    if (!match[0] && (match.index === start || !/[,;.]\s*$|\band\s*$/i.test(source.slice(start, match.index)) && !/^and\s/i.test(source.slice(match.index)))) continue;
    append(match.index); start = match.index + match[0].length;
  }
  append(source.length);
  return clauses;
}

function nonCandidateClause(value) {
  const clause = String(value).trim().replace(/^and\s+/i, '');
  if (instruction.test(clause)) return true;
  if (new RegExp('^(?:(?:my|our|the|a|another)\\s+)?' + otherRole + '\\b', 'i').test(clause)) return true;
  if (/^(?:he|she|they|his|her|their)\b/i.test(clause)) return true;
  if (isNamedOwner(clause)) return true;
  if (/\b(?:colleague|teammate|manager|client|customer)\b.{0,45}\b(?:said|says|stated|reported|explained)\b/i.test(clause)) return true;
  if (/\b(?:assignment|brief|specification|job description|instructions?|requested approach)\b/i.test(clause)
    && /\b(?:said|says|requires?|asked|requested|wanted|expected|suggested|stated|specified|approach)\b/i.test(clause)
    && !/\bI\s+(?:implemented|built|wrote|used|delivered)\b/i.test(clause)) return true;
  const passiveOwner = /\b(?:built|written|developed|implemented)\s+by\s+(?!me\b|us\b)/i.exec(clause);
  if (passiveOwner && !/\b(?:I|we)\s+(?:(?:have|had|also|then)\s+)*(?:built|wrote|developed|implemented|used|created)\b/i.test(clause.slice(0, passiveOwner.index))) return true;
  return false;
}

function skillPrefixLength(value, skill) {
  const key = normalizeSkill(skill);
  for (let length = Math.min(value.length, 80); length > 0; length--) {
    const prefix = value.slice(0, length);
    if (normalizeSkill(prefix) === key && hasSkill(prefix, skill)
      && (!value[length] || !/[a-z0-9_+#]/i.test(value[length]))) return length;
  }
  return 0;
}

function startsWithSkill(value, skill) {
  const candidate = value.trim().replace(/^(?:any|the|either|both)\s+/i, '').replace(/^["'“‘([]\s*/, '');
  const length = skillPrefixLength(candidate, skill);
  if (!length) return false;
  const rest = candidate.slice(length);
  return !rest || /^[.;!?"'’”)\]](?:\s|$)/.test(rest)
    || /^\s+(?:skills?\b|programming\b|experience\b|knowledge\b|proficiency\b|ability\b|framework\b|library\b|language\b|services?\b|applications?\b|development\b|tools?\b|at\s+all\b|well\b|yet\b|before\b|currently\b|professionally\b|either\b|in\b|on\b|for\b|as\b|to\b|with\b)/i.test(rest);
}

function deniedListContains(value, skill) {
  // "or know Python" inherits the negative verb scope; "and use Python"
  // remains a separate positive assertion unless it repeats the negation.
  const parts = value.split(/\s*(,|\||\band\b|\bor\b|\bnor\b)\s*/i);
  return parts.some((part, index) => {
    const inheritedAction = index > 0 && /^(?:or|nor)$/i.test(parts[index - 1]);
    const target = inheritedAction ? part.replace(new RegExp('^(?:' + coordinatedAction + ')(?:\\s+or\\s+(?:' + coordinatedAction + '))*\\s+', 'i'), '') : part;
    return startsWithSkill(target, skill);
  });
}

function explicitlyDeniesSkill(text, skill) {
  if (typeof skill !== 'string' || !skill.trim()) return false;
  for (const clause of splitClaimClauses(text)) {
      if (nonCandidateClause(clause)) continue;
      for (const prefix of denialPrefixes) {
        for (const match of clause.matchAll(prefix)) {
          if (deniedListContains(clause.slice(match.index + match[0].length), skill)) return true;
        }
      }
      for (const match of clause.matchAll(/\bno\s+(.+?)\s+(?:programming\s+)?(?:skills?|experience|knowledge|proficiency|ability)\b/gi)) {
        if (deniedListContains(match[1], skill)) return true;
      }
      for (const match of clause.matchAll(/(?:^|[:,>])\s*(.+?)\s+(?:(?:is|are)\s+not|(?:isn|aren)['’]t)\s+(?:(?:among|one\s+of)\s+my\s+skills|a\s+skill\s+I\s+have|something\s+I\s+(?:know|use))\b/gi)) {
        if (deniedListContains(match[1], skill)) return true;
      }
  }
  return false;
}

module.exports = { explicitlyDeniesSkill, splitClaimClauses, nonCandidateClause, skillPrefixLength };
