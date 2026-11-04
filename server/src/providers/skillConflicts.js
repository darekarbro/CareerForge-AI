const { SKILLS, normalizeSkill, hasSkill, extractSkills, plain } = require('./resumeFacts');
const { resumeEvidence, isSkillList, usablePositive } = require('./resumeEvidence');
const { explicitlyDeniesSkill } = require('./skillPolarity');

const canonical = new Map(SKILLS.map((skill) => [normalizeSkill(skill), skill]));
const narrative = (content) => resumeEvidence(content).filter((item) => !isSkillList(item));
const uniqueEvidence = (values) => [...new Map(values.map((item) => [item.path + ':' + item.quote, item])).values()].slice(0, 3);
const uniqueClaims = (values) => [...new Map(values.map(({ quote }) => [quote, { quote }])).values()].slice(0, 3);
const warningSuffix = ' was both claimed and denied. It was withheld from positive skills; review the conflicting statements.';

function activeSkillConflicts(content = {}) {
  const data = plain(content), statements = narrative(data);
  if (!Array.isArray(data.skillConflicts)) return [];
  return data.skillConflicts.flatMap((conflict, index) => {
    const skill = canonical.get(normalizeSkill(conflict?.skill || ''));
    if (!skill || !Array.isArray(conflict.positiveEvidence) || !Array.isArray(conflict.negativeEvidence)) return [];
    const positiveEvidence = conflict.positiveEvidence.flatMap((item, evidenceIndex) => typeof item?.quote === 'string'
      && hasSkill(item.quote, skill) && usablePositive(item)
      ? [{ path: `skillConflicts[${index}].positiveEvidence[${evidenceIndex}].quote`, quote: item.quote }] : []);
    const negativeEvidence = conflict.negativeEvidence.filter((item) => typeof item?.path === 'string' && typeof item.quote === 'string'
      && statements.some((statement) => statement.path === item.path && statement.quote === item.quote)
      && explicitlyDeniesSkill(item.quote, skill));
    return positiveEvidence.length && negativeEvidence.length ? [{ skill, positiveEvidence, negativeEvidence }] : [];
  });
}

function suppress(content, conflicts) {
  const excluded = new Set(conflicts.map((conflict) => normalizeSkill(conflict.skill)));
  for (const [key, values] of Object.entries(content.skills || {})) {
    if (Array.isArray(values)) content.skills[key] = values.filter((skill) => typeof skill !== 'string' || !excluded.has(normalizeSkill(skill)));
  }
  for (const project of content.projects || []) if (Array.isArray(project.technologies)) {
    project.technologies = project.technologies.filter((skill) => !excluded.has(normalizeSkill(skill)));
  }
  if (conflicts.length) content.skillConflicts = conflicts.map((conflict) => ({ skill: conflict.skill,
    positiveEvidence: conflict.positiveEvidence.map(({ quote }) => ({ quote })),
    negativeEvidence: conflict.negativeEvidence.map(({ path, quote }) => ({ path, quote })) }));
  else delete content.skillConflicts;
  return content;
}

function reconcileSkillConflicts(content, listedEvidence = []) {
  const data = plain(content), evidence = resumeEvidence(data);
  const positive = [...listedEvidence.map((quote) => ({ quote })), ...evidence].filter(usablePositive);
  const candidates = extractSkills(positive.map((item) => item.quote).join('\n'));
  const conflicts = candidates.flatMap((skill) => {
    const denied = uniqueEvidence(evidence.filter((item) => !isSkillList(item) && explicitlyDeniesSkill(item.quote, skill)));
    if (!denied.length) return [];
    return [{ skill, positiveEvidence: uniqueClaims(positive.filter((item) => hasSkill(item.quote, skill))), negativeEvidence: denied }];
  });
  for (const conflict of activeSkillConflicts(data)) if (!conflicts.some((item) => normalizeSkill(item.skill) === normalizeSkill(conflict.skill))) conflicts.push(conflict);
  return suppress(data, conflicts);
}

function refreshSkillConflicts(content, previous = {}) {
  // Client metadata is not evidence. Carry only server-owned claims whose exact denial still occurs in current narrative.
  const data = plain(content); delete data.skillConflicts;
  const current = reconcileSkillConflicts(data), statements = narrative(current);
  const bySkill = new Map((current.skillConflicts || []).map((conflict) => [normalizeSkill(conflict.skill), conflict]));
  for (const conflict of activeSkillConflicts(previous)) {
    const negativeEvidence = uniqueEvidence(statements.filter((item) => conflict.negativeEvidence.some((old) => old.quote === item.quote)
      && explicitlyDeniesSkill(item.quote, conflict.skill)));
    if (negativeEvidence.length && !bySkill.has(normalizeSkill(conflict.skill))) bySkill.set(normalizeSkill(conflict.skill), {
      skill: conflict.skill, positiveEvidence: conflict.positiveEvidence, negativeEvidence,
    });
  }
  return suppress(current, [...bySkill.values()]);
}

function conflictWarnings(content, warnings = []) {
  return [...warnings.filter((warning) => typeof warning === 'string' && !warning.endsWith(warningSuffix)),
    ...activeSkillConflicts(content).map((conflict) => conflict.skill + warningSuffix)];
}

module.exports = { reconcileSkillConflicts, activeSkillConflicts, refreshSkillConflicts, conflictWarnings };
