const { extractSkills, hasSkill, normalizeSkill, plain } = require('../providers/resumeFacts');
const { extractRequirements, experienceDurations } = require('./jobRequirements');
const { rubric } = require('./assessmentRubrics');
const { resumeEvidence, negative, isSkillList, usablePositive } = require('../providers/resumeEvidence');
const { activeSkillConflicts } = require('../providers/skillConflicts');
const { explicitlyDeniesSkill, nonCandidateClause } = require('../providers/skillPolarity');

const durationEvidenceField = /^(?:summary$|workExperience\[\d+\]\.highlights\[|projects\[\d+\]\.(?:description$|highlights\[))/;
const nonDomainWords = /^(?:a|an|the|of|in|with|and|or|for|as|professional|commercial|practical|relevant|prior|industry|work|working|employment|experience|practice|hands|on)$/;
const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function domainWords(text) {
  const lower = text.toLowerCase();
  const words = (lower.match(/[a-z]+/g) || []).filter(word => !nonDomainWords.test(word));
  if (!words.includes('software')) return words;
  return words.map(word => /^(?:developer|development|engineer|engineering|delivery|delivering)$/.test(word) ? 'delivery' : word);
}

function coversDomain(text, domain) {
  const words = new Set(domainWords(text));
  return domain.every(word => words.has(word));
}

function personalDuration(item, claim) {
  if (claim.approximateOrUpperBound || negative(claim.sourceText) || nonCandidateClause(claim.sourceText)) return false;
  if (/^["'“‘]/.test(item.quote)) return false;
  if (/\b(?:required|preferred|must[ -]have|mandatory)\b/i.test(claim.sourceText)) return false;
  const prefix = claim.prefix.replace(/^[-*•]\s*/, '').trim();
  if (!prefix || /^(?:experience|(?:i|we)\s+(?:have|had|bring|offer|possess|spent|accumulated|completed))\s*:?\s*(?:a total of|over|more than|at least)?$/i.test(prefix)) {
    return Boolean(claim.scope || claim.generalExperience || /^experience\s*:/i.test(prefix));
  }
  const beforeFor = prefix.replace(/(?:\s+for|:)$/i, '');
  if (beforeFor === prefix) return false;
  if (extractSkills(beforeFor).some(skill => normalizeSkill(skill) === normalizeSkill(beforeFor))) return true;
  return /^(?:i|we)\s+(?:(?:have|had|personally)\s+)*(?:worked|used|built|developed|managed|maintained|served|operated)\s+/i.test(beforeFor)
    && !/\b(?:colleague|teammate|vendor|contractor|manager|client|partner|team|friend|their|his|her)\b/i.test(beforeFor);
}

function closedDate(value, isStart) {
  const numeric = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(value);
  const named = /^([a-z]{3,9})\s+(\d{4})$/i.exec(value);
  const year = Number(numeric?.[1] || named?.[2]);
  if (year < 1900 || !Number.isFinite(year)) return NaN;
  const month = numeric?.[2] ? Number(numeric[2]) - 1 : named ? months.indexOf(named[1].slice(0, 3).toLowerCase()) : isStart ? 11 : 0;
  if (month < 0 || month > 11) return NaN;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = numeric?.[3] ? Number(numeric[3]) : isStart ? lastDay : 1;
  return day >= 1 && day <= lastDay ? Date.UTC(year, month, day) : NaN;
}

function datedExperienceEvidence(resumeData, evidence, domain, minimumYears) {
  const now = Date.now();
  const intervals = (resumeData.workExperience || []).flatMap((entry, index) => {
    const path = `workExperience[${index}]`;
    const scopeEvidence = domain.length ? evidence.find(item => item.path === path + '.role' && coversDomain(item.quote, domain) && !negative(item.quote)) : null;
    if (entry.current || domain.length && !scopeEvidence) return [];
    const startQuote = String(entry.startDate || ''), endQuote = String(entry.endDate || '');
    const start = closedDate(startQuote.trim(), true), end = closedDate(endQuote.trim(), false);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end > now) return [];
    return [{ start, end, evidence: [
      { path: path + '.startDate', quote: startQuote }, { path: path + '.endDate', quote: endQuote }, ...(scopeEvidence ? [scopeEvidence] : []),
    ] }];
  }).sort((a, b) => a.start - b.start);
  // Use the union of conservatively bounded closed intervals to avoid counting concurrent jobs twice.
  const merged = [];
  for (const { start, end } of intervals) {
    const last = merged.at(-1);
    if (last && start <= last.end) last.end = Math.max(last.end, end);
    else merged.push({ start, end });
  }
  const years = merged.reduce((sum, item) => sum + (item.end - item.start) / (365.25 * 86400000), 0);
  return years >= minimumYears ? intervals.flatMap(item => item.evidence) : [];
}

function experienceEvidence(row, evidence, resumeData) {
  if (!Number.isFinite(row.minimumYears)) return [];
  const scopeSkills = row.scopeSkills || [];
  if (scopeSkills.some(skill => activeSkillConflicts(resumeData).some(conflict => hasSkill(conflict.skill, skill))
    || evidence.some(item => !isSkillList(item) && explicitlyDeniesSkill(item.quote, skill)))) return [];
  const domain = scopeSkills.length ? [] : domainWords(experienceDurations(row.sourceText || row.label)[0]?.scope || '');
  const direct = evidence.filter(item => durationEvidenceField.test(item.path) && !nonCandidateClause(item.quote)).flatMap(item =>
    experienceDurations(item.quote).filter(claim => claim.years >= row.minimumYears && personalDuration(item, claim)
      && scopeSkills.every(skill => hasSkill(claim.scope, skill)) && coversDomain(claim.scope, domain))
      .map(claim => ({ path: item.path, quote: claim.sourceText })));
  if (direct.length) return direct.slice(0, 3);
  // A dated role alone cannot establish the portion of time spent with a particular skill.
  return scopeSkills.length ? [] : datedExperienceEvidence(resumeData, evidence, domain, row.minimumYears);
}

function evaluateRequirement(requirement, evidence, resumeData) {
  const row = { ...requirement, status: 'missing', supportingEvidence: [], missingEvidence: '', explanation: '' };
  if (/_skill$/.test(row.category)) {
    const relevant = evidence.filter((item) => hasSkill(item.quote, row.label));
    const conflict = activeSkillConflicts(resumeData).find((item) => hasSkill(item.skill, row.label));
    const negativeNarrative = relevant.filter((item) => !isSkillList(item) && explicitlyDeniesSkill(item.quote, row.label));
    const positive = relevant.filter((item) => usablePositive(item, row.label));
    const usable = positive;
    row.supportingEvidence = conflict ? conflict.positiveEvidence : usable.slice(0, 3);
    if (conflict || negativeNarrative.length) row.conflictingEvidence = conflict ? conflict.negativeEvidence : negativeNarrative;
    row.status = row.ambiguousAlternative || conflict || negativeNarrative.length && usable.length ? 'uncertain' : usable.length ? 'supported' : 'missing';
    row.missingEvidence = row.status === 'supported' ? '' : row.ambiguousAlternative ? 'Confirm which alternative qualification is acceptable.'
      : conflict || negativeNarrative.length ? 'Clarify the negative or conflicting skill statement with a concrete example.' : 'Add a truthful project, course or work example demonstrating ' + row.label + '.';
    row.explanation = row.status === 'supported' ? 'A direct skill mention is self-reported evidence; it does not verify proficiency.'
      : row.status === 'uncertain' ? 'Ambiguous alternatives or contradictory statements require manual review.' : 'No usable positive evidence was found; this does not establish inability.';
  } else if (row.category === 'experience') {
    row.supportingEvidence = experienceEvidence(row, evidence, resumeData);
    row.status = row.supportingEvidence.length ? 'supported' : 'uncertain';
    row.missingEvidence = row.status === 'supported' ? '' : 'Confirm relevant duration, scope and seniority with dates and examples; employment tenure alone does not prove skill-specific years.';
    row.explanation = row.status === 'supported' ? 'A personal duration statement or relevant closed employment dates cover the stated minimum.' : 'Available evidence does not establish the requested experience. Ambiguous dates and open-ended roles are not estimated.';
  } else {
    row.status = 'uncertain';
    row.missingEvidence = 'Confirm this constraint explicitly with the candidate and employer: ' + row.label;
    row.explanation = 'Location, eligibility, availability and preferences are not inferred from identity, residence or technical skills.';
  }
  row.explanation += ' Weight ' + row.weight + ' (' + row.category.replaceAll('_', ' ') + ') affects the evidence-coverage denominator; only supported evidence earns credit.';
  return row;
}

function assessMatch({ resumeData = {}, jobDescriptionText = '', targetRole = 'Software Engineer' } = {}) {
  const data = plain(resumeData), requirements = extractRequirements(jobDescriptionText), evidence = resumeEvidence(data);
  const rows = [...requirements.requiredSkills, ...requirements.preferredSkills, ...requirements.experience, ...requirements.constraints]
    .map((requirement) => evaluateRequirement(requirement, evidence, data));
  const supported = rows.filter((row) => row.status === 'supported'), totalWeight = rows.reduce((sum, row) => sum + row.weight, 0);
  const missing = (row) => ({ skill: row.label, importance: row.category === 'preferred_skill' ? 'medium' : 'high', recommendation: row.missingEvidence });
  return { matchScore: totalWeight ? Math.round(supported.reduce((sum, row) => sum + row.weight, 0) / totalWeight * 100) : 0,
    matchedSkills: supported.filter((row) => /_skill$/.test(row.category)).map((row) => ({ skill: row.label, category: row.category, supportingResumeLines: row.supportingEvidence.map((item) => item.quote) })),
    mustHaveMissing: rows.filter((row) => row.category === 'required_skill' && row.status !== 'supported').map(missing),
    niceToHaveMissing: rows.filter((row) => row.category === 'preferred_skill' && row.status !== 'supported').map(missing),
    summaryRecommendations: [
      'Requirement evidence assessment for ' + targetRole + '; confirm every citation against the source resume.',
      ...(rows.length ? [] : ['No requirements could be classified; a zero score here means insufficient assessment coverage.']),
      ...(requirements.unclassified.length ? ['Review ' + requirements.unclassified.length + ' unclassified source clauses; they are excluded from the score.'] : []),
      ...rows.filter((row) => row.status !== 'supported').map((row) => row.missingEvidence).slice(0, 6),
    ], requirements, requirementMatches: rows,
    evidenceCoverage: { supported: supported.length, total: rows.length, ratio: rows.length ? supported.length / rows.length : 0 },
    rubric: { ...rubric('job-match'), weights: { required_skill: 3, preferred_skill: 1, experience: 2, constraint: 2 },
      uncertainty: { level: rows.some((row) => row.status === 'uncertain') || requirements.unclassified.length ? 'high' : 'limited',
        uncertainRequirements: rows.filter((row) => row.status === 'uncertain').length, unclassifiedClauses: requirements.unclassified.length,
        reason: 'Evidence coverage is not a calibrated confidence interval or hiring probability.' } } };
}
module.exports = { assessMatch, resumeEvidence, evaluateRequirement, negative };
