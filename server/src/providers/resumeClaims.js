const { SKILLS, extractSkills, normalizeSkill, hasSkill } = require('./resumeFacts');
const { instruction } = require('../services/jobRequirements');
const { explicitlyDeniesSkill, splitClaimClauses, nonCandidateClause } = require('./skillPolarity');

const declaration = /^(?:(?:my|our|technical|core|key|current|practical)\s+)*(?:skills?(?:\s+sheet)?|competencies|capabilities|technologies|tools?(?:\s+I\s+use)?|technical repertoire)\s*(?::+|=>|->|[|>])\s*/i;
const actions = /\b(?:use|used|using|build|built|write|wrote|implement|implemented|maintain|maintained|develop|developed|create|created|design|designed|deliver|delivered|prepare|prepared|administer|administered|operate|operated|package|packaged|query|queried|test|tested|apply|applied|style|styled|store|stored|run|ran|review|reviewed|train|trained|know|knowledge|skills?|experience|work)\b/i;
const headlessAction = /^(?:[-*•]\s*|\(\d+\)\s*|\d+[.)]\s*)?(?:Built|Implemented|Wrote|Developed|Created|Maintained|Designed|Delivered|Prepared|Administered|Operated|Packaged|Queried|Tested|Applied|Styled|Stored|Ran|Reviewed|Trained|Used|Using|Experience|Skilled|Proficient|Familiar)\b/i;
const possessivePredicate = /\b(?:my|our)\s+(?:deployment\s+environment|technical\s+background|tech(?:nical)?\s+stack|stack|work|skills?|experience|projects?|foundations|fundamentals)\b.{0,70}\b(?:is|are|includes?|consists?\s+of)\b/i;
const canonical = new Map(SKILLS.map(skill => [normalizeSkill(skill), skill]));

function bareSkillList(text) {
  let rest = text.trim().replace(/^[-*•]\s*/, '').replace(/[.!]+$/, '');
  let found = false;
  while (rest) {
    const separator = rest.match(/^(?:\s+|[,;|•·]+|::|\s*\/\s*|\band\b|\bor\b|\balso\b)+/i);
    if (separator) { rest = rest.slice(separator[0].length); continue; }
    let length = 0;
    for (let end = Math.min(rest.length, 80); end > 0; end--) {
      const skill = canonical.get(normalizeSkill(rest.slice(0, end)));
      if (skill && hasSkill(rest.slice(0, end), skill) && (!rest[end] || !/[a-z0-9_+#]/i.test(rest[end]))) { length = end; break; }
    }
    if (!length) return false;
    found = true; rest = rest.slice(length);
  }
  return found;
}

function aspiringSkill(text, skill) {
  for (const match of text.matchAll(/\b(?:(?:want|hope|plan|planning|aim|intend|wish)\s+to|would\s+like\s+to|interested\s+in)\s+(?:learn(?:ing)?|study(?:ing)?|use|try|explore|train|work\s+with|become\s+(?:proficient|skilled|experienced)\s+in)\s+|\b(?:am|currently|still|started)\s+(?:learning|studying)\s+|^(?:learning|studying)\s+|\b(?:next\s+)?(?:learning\s+)?goals?\s*(?::|is|are)\s*/gi)) {
    const goal = text.slice(match.index + match[0].length).split(/\band\s+(?:(?:I|we)\s+)?(?:use|build|write|implement|maintain|work)\b/i)[0];
    if (hasSkill(goal, skill)) return true;
  }
  return false;
}

function excludedMention(text, skill, listed) {
  if (aspiringSkill(text, skill)) return true;
  const nextAssertion = /\band\s+(?:(?:I|we)\s+)?(?:use|used|build|built|write|wrote|implement|implemented|maintain|maintained|apply|applied)\b/i;
  for (const match of text.matchAll(/\b(?:document|article|book|paper|guide|documentation|tutorial)\s+(?:about|on|covering)\s+/gi)) {
    if (hasSkill(text.slice(match.index + match[0].length).split(nextAssertion)[0], skill)) return true;
  }
  for (const match of text.matchAll(/\b(?:to\s+replace|replacing|replacement\s+for)\s+([^.;!?]+?)\s+(?:written|built|developed|implemented|trained)\s+by\s+(?!me\b|us\b)/gi)) {
    if (hasSkill(match[1], skill)) return true;
  }
  for (const match of text.matchAll(/\b(?:without|rather than|instead of)\s+/gi)) if (hasSkill(text.slice(match.index + match[0].length), skill)) return true;
  if (skill === 'Go' && !listed && !/\bGolang\b|\bGo\b/.test(text) && !/\b(?:use|using|in|with|language)\s+go\b/i.test(text)) return true;
  if (skill === 'Express' && /\bI\s+express\b/i.test(text) && !/\bExpress\b|express\s+(?:framework|handlers?|server|middleware)/.test(text)) return true;
  // An organization name in a work assertion is context, not technology used.
  for (const match of text.matchAll(/\b(?:at|for)\s+((?:[A-Z][\w.+#-]*\s+){0,5}(?:Services|Solutions|Labs|Company|Works|Consulting|Technologies|Factory|Inc\.?|Ltd\.?|Corporation))\b/g)) {
    if (hasSkill(match[1], skill)) return true;
  }
  for (const match of text.matchAll(/\b(?:work(?:ed|ing)?\s+(?:at|for)|employed\s+by|employee\s+of|employer\s*:|company\s*:)\s+([^,;.!?]+)/gi)) {
    const employer = match[1].split(/\b(?:and|I|we|using|with|where)\b/)[0];
    if (hasSkill(employer, skill)) return true;
  }
  return false;
}

// candidateText contains exact eligible source substrings, never generated prose.
// Both positive and denied sets can contain a skill when separate assertions conflict.
function analyzeSkillClaims(text, { context = 'unknown' } = {}) {
  const positive = new Set(), denied = new Set(), candidateText = [];
  let continuation = false;
  for (const raw of splitClaimClauses(text)) {
    if (instruction.test(raw) || nonCandidateClause(raw)) { continuation = false; continue; }
    const stripped = raw.replace(declaration, ''), declared = stripped !== raw;
    const skills = extractSkills(stripped);
    if (!skills.length) continue;
    const denialSkills = skills.filter(skill => explicitlyDeniesSkill(raw, skill));
    const contact = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(raw);
    const identityOrEmployer = /\b(?:Candidate|University|College|Institute|School|Academy|Inc\.?|Ltd\.?|Corporation)\b/.test(raw)
      || /^(?:employer|company|organization|education|degree|name|contact)\s*[:|]/i.test(raw)
      || /\b(?:Engineer|Developer|Architect|Consultant)\b/.test(raw)
      || /^(?:Bachelor|Master|Doctor|Ph\.?D|B\.?Sc|M\.?Sc|B\.?Tech|M\.?Tech)\b/i.test(raw)
      || /^(?:[A-Z][\w.+#-]*\s+)*(?:Services|Solutions|Labs|Company|Works|Consulting|Technologies|Factory)\s*$/u.test(raw);
    const supportedNounClaim = /^\s*(?:and\s+)?(.+?)\s+(?:experience|skills?|proficiency)\s+(?:from|through)\b/i.exec(raw);
    const projectContribution = raw.replace(/^(?:(?:my|selected|personal|academic|recent)\s+)?project(?:\s+(?:work|contribution))?\s*[:—–-]\s*/i, '');
    const candidateAssertion = /\b(?:I|we|my|our)\b/i.test(raw) && actions.test(raw) || headlessAction.test(projectContribution)
      || possessivePredicate.test(raw) || supportedNounClaim && bareSkillList(supportedNounClaim[1]);
    const listed = declared || context === 'skills' && !identityOrEmployer || bareSkillList(stripped);
    const copiedRequirement = /\b(?:required|preferred|must[ -]have)\b/i.test(raw) && !candidateAssertion;
    const canAssert = !contact && !copiedRequirement && (candidateAssertion || listed || continuation && /^(?:also|use|build|write|implement|maintain|work|operate|run|know)\b/i.test(raw));
    const positiveSkills = canAssert ? skills.filter(skill => !explicitlyDeniesSkill(raw, skill) && !excludedMention(raw, skill, declared || context === 'skills')) : [];
    for (const skill of positiveSkills) positive.add(canonical.get(normalizeSkill(skill)) || skill);
    for (const skill of denialSkills) denied.add(skill);
    if (positiveSkills.length || denialSkills.length) candidateText.push(raw);
    continuation = candidateAssertion || listed;
  }
  return { positiveSkills: SKILLS.filter(skill => positive.has(skill)), deniedSkills: SKILLS.filter(skill => denied.has(skill)), candidateText: [...new Set(candidateText)], excluded: candidateText.length === 0 };
}

module.exports = { analyzeSkillClaims };
