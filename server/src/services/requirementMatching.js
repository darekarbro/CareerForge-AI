const { hasSkill, plain } = require('../providers/resumeFacts');
const { extractRequirements } = require('./jobRequirements');
const { rubric } = require('./assessmentRubrics');
const { resumeEvidence, negative, isSkillList, usablePositive } = require('../providers/resumeEvidence');
const { activeSkillConflicts } = require('../providers/skillConflicts');
const { explicitlyDeniesSkill } = require('../providers/skillPolarity');


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
    row.status = 'uncertain';
    const years = evidence.filter((item) => !isSkillList(item) && !negative(item.quote)).map((item) => {
      const match = item.quote.match(/(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)\b/i);
      return { ...item, years: match ? Number(match[1]) : null };
    }).filter((item) => item.years !== null && (!row.scopeSkills?.length || row.scopeSkills.every((skill) => hasSkill(item.quote, skill))));
    if (Number.isFinite(row.minimumYears) && years.some((item) => item.years >= row.minimumYears)) {
      row.status = 'supported'; row.supportingEvidence = years.filter((item) => item.years >= row.minimumYears).slice(0, 3).map(({ path, quote }) => ({ path, quote }));
    } else if (Number.isFinite(row.minimumYears) && !row.scopeSkills?.length) {
      // Only closed date intervals are considered. Year-only dates use a conservative lower bound.
      const intervals = (resumeData.workExperience || []).map((entry, index) => {
        const start = String(entry.startDate || ''), end = String(entry.endDate || '');
        const parse = (value, isStart) => /^\d{4}$/.test(value) ? Date.UTC(Number(value), isStart ? 11 : 0, isStart ? 31 : 1) : Date.parse(value);
        return { start: parse(start, true), end: /present|current|now/i.test(end) ? NaN : parse(end, false), index, startQuote: start, endQuote: end };
      }).filter((entry) => Number.isFinite(entry.start) && Number.isFinite(entry.end) && entry.end > entry.start && entry.end <= Date.now()).sort((a, b) => a.start - b.start);
      const merged = [];
      for (const item of intervals) {
        const last = merged[merged.length - 1];
        if (last && item.start <= last.end) last.end = Math.max(last.end, item.end);
        else merged.push({ start: item.start, end: item.end });
      }
      const totalYears = merged.reduce((sum, item) => sum + (item.end - item.start) / (365.25 * 86400000), 0);
      if (totalYears >= row.minimumYears) {
        row.status = 'supported'; row.supportingEvidence = intervals.flatMap((item) => [
          { path: 'workExperience[' + item.index + '].startDate', quote: item.startQuote },
          { path: 'workExperience[' + item.index + '].endDate', quote: item.endQuote },
        ]);
      }
    }
    row.missingEvidence = row.status === 'supported' ? '' : 'Confirm relevant duration, scope and seniority with dates and examples; employment tenure alone does not prove skill-specific years.';
    row.explanation = row.status === 'supported' ? 'An explicit duration statement or conservative non-overlapping closed employment intervals cover the stated minimum; relevance still needs review.' : 'Available evidence does not establish the requested experience. Ambiguous dates and open-ended roles are not estimated.';
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
