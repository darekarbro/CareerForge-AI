const { normalizeSkill } = require('../src/providers/resumeFacts');

const categoryName = category => ({ required_skill: 'requiredSkills', preferred_skill: 'preferredSkills' }[category] || category);
const requirementKey = item => `${categoryName(item.category)}:${normalizeSkill(item.label)}`;
const ratio = (numerator, denominator) => denominator ? numerator / denominator : null;
const round = number => number === null ? null : Math.round(number * 1000000) / 1000000;

function setCounts(expected, actual) {
  const gold = new Set(expected), predicted = new Set(actual);
  return { truePositive: [...predicted].filter(item => gold.has(item)).length,
    falsePositive: [...predicted].filter(item => !gold.has(item)).length,
    falseNegative: [...gold].filter(item => !predicted.has(item)).length };
}
function prf(counts) {
  const precision = ratio(counts.truePositive, counts.truePositive + counts.falsePositive);
  const recall = ratio(counts.truePositive, counts.truePositive + counts.falseNegative);
  return { ...counts, precision: round(precision), recall: round(recall),
    f1: round(ratio(2 * counts.truePositive, 2 * counts.truePositive + counts.falsePositive + counts.falseNegative)) };
}
function citedValue(data, path) {
  if (typeof path !== 'string' || !/^[A-Za-z][\w.]*(?:\[\d+\][\w.]*)*$/.test(path)) return undefined;
  return path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean).reduce((value, key) =>
    value && Object.hasOwn(value, key) ? value[key] : undefined, data);
}
function validCitation(data, evidence) {
  const source = citedValue(data, evidence.path);
  return typeof source === 'string' && typeof evidence.quote === 'string' && evidence.quote.trim().length > 0 && source.includes(evidence.quote);
}

function evaluateCase(fixture, parsed, match, latencyMs = 0) {
  const expected = fixture.expectedExtraction;
  const rows = match.requirementMatches || [];
  const gold = new Map(fixture.expectedRequirements.map(item => [requirementKey(item), item]));
  const skillRows = rows.filter(item => ['requiredSkills', 'preferredSkills'].includes(categoryName(item.category)));
  const predicted = new Map(skillRows.map(item => [requirementKey(item), item]));
  const supported = rows.filter(item => item.status === 'supported');
  const labeledSupported = supported.filter(item => gold.has(requirementKey(item)));
  const citations = rows.flatMap(item => [...(item.supportingEvidence || []), ...(item.conflictingEvidence || [])]);
  return { id: fixture.id, group: fixture.group, matchScore: match.matchScore, latencyMs,
    resumeSkills: setCounts(expected.skills.map(normalizeSkill), (parsed.skills?.all || []).map(normalizeSkill)),
    contacts: { correct: ['name', 'email'].filter(key => (parsed.contactInfo?.[key] || '').trim() === expected.contactInfo[key].trim()).length, total: 2 },
    requirementExtraction: setCounts([...gold.keys()], [...predicted.keys()]),
    requirementStatus: { correct: [...gold].filter(([key, item]) => predicted.get(key)?.status === item.status).length, total: gold.size },
    unsupportedClaims: { count: labeledSupported.filter(item => gold.get(requirementKey(item)).status !== 'supported').length, total: labeledSupported.length },
    citationIntegrity: { valid: citations.filter(evidence => validCitation(parsed, evidence)).length, total: citations.length },
    evidenceCoverage: { supportedWithValidEvidence: supported.filter(item => (item.supportingEvidence || []).some(evidence => validCitation(parsed, evidence))).length,
      supported: supported.length, totalRequirements: rows.length },
    failures: { unexpectedSkills: (parsed.skills?.all || []).filter(skill => !expected.skills.map(normalizeSkill).includes(normalizeSkill(skill))),
      missingSkills: expected.skills.filter(skill => !(parsed.skills?.all || []).map(normalizeSkill).includes(normalizeSkill(skill))),
      contacts: ['name', 'email'].filter(key => (parsed.contactInfo?.[key] || '').trim() !== expected.contactInfo[key].trim()),
      requirements: [...gold].filter(([key, item]) => predicted.get(key)?.status !== item.status).map(([key, item]) => ({ requirement: key, expected: item.status, actual: predicted.get(key)?.status || 'not-extracted' })) } };
}

function summarize(results, reviews = []) {
  const sum = (metric, key) => results.reduce((total, item) => total + item[metric][key], 0);
  const counts = metric => Object.fromEntries(['truePositive', 'falsePositive', 'falseNegative'].map(key => [key, sum(metric, key)]));
  const fraction = (metric, numerator, denominator) => ({ [numerator]: sum(metric, numerator), [denominator]: sum(metric, denominator), rate: round(ratio(sum(metric, numerator), sum(metric, denominator))) });
  const sorted = results.map(item => item.latencyMs).sort((a, b) => a - b);
  const percentile = p => sorted.length ? sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)] : null;
  const included = reviews.filter(review => results.some(item => item.id === review.caseId));
  const reviewedCases = [...new Set(included.map(review => review.caseId))];
  const errors = reviewedCases.map(id => {
    const scores = included.filter(review => review.caseId === id).map(review => review.matchScore);
    const mean = scores.reduce((total, score) => total + score, 0) / scores.length;
    return Math.abs(results.find(item => item.id === id).matchScore - mean);
  });
  return { cases: results.length,
    extractionAccuracy: { contactExact: fraction('contacts', 'correct', 'total'), resumeSkills: prf(counts('resumeSkills')), jdSkills: prf(counts('requirementExtraction')) },
    requirementStatusAccuracy: fraction('requirementStatus', 'correct', 'total'),
    unsupportedClaimRate: fraction('unsupportedClaims', 'count', 'total'),
    citationIntegrity: fraction('citationIntegrity', 'valid', 'total'),
    evidenceCoverage: { supportedWithValidEvidence: sum('evidenceCoverage', 'supportedWithValidEvidence'), supported: sum('evidenceCoverage', 'supported'), totalRequirements: sum('evidenceCoverage', 'totalRequirements'),
      supportedClaimCoverage: round(ratio(sum('evidenceCoverage', 'supportedWithValidEvidence'), sum('evidenceCoverage', 'supported'))),
      allRequirementCoverage: round(ratio(sum('evidenceCoverage', 'supportedWithValidEvidence'), sum('evidenceCoverage', 'totalRequirements'))) },
    humanScoreAgreement: included.length ? { status: 'measured-from-supplied-human-annotations', reviewedCases: reviewedCases.length, reviews: included.length,
      meanAbsoluteError: round(errors.reduce((total, error) => total + error, 0) / errors.length), withinTenPointsRate: round(errors.filter(error => error <= 10).length / errors.length) }
      : { status: 'not-measured', reviewedCases: 0, reviews: 0, meanAbsoluteError: null, withinTenPointsRate: null,
        reason: 'No independent human reviewer scores have been supplied; synthetic reference labels are not human score reviews.' },
    latencyMs: { scope: 'Local raw-text parsing plus requirement matching; excludes upload, queue, database, network and UI.', samples: sorted.length,
      p50: round(percentile(.5)), p95: round(percentile(.95)), mean: round(sorted.length ? sorted.reduce((total, value) => total + value, 0) / sorted.length : null) },
    providerCost: { mode: 'offline-rules', externalRequests: 0, billedTokens: 0, costUsd: 0, scope: 'No external provider calls; infrastructure and engineering cost excluded.' } };
}

function validateReviews(document, { datasetVersion, rubricVersion, validCaseIds }) {
  if (document.datasetVersion !== datasetVersion || document.rubricVersion !== rubricVersion || document.annotationMethod !== 'independent-human-review' || !Array.isArray(document.reviews)) {
    throw new Error('Human annotations must identify the current dataset/rubric and independent-human-review method.');
  }
  const keys = new Set();
  for (const review of document.reviews) {
    const key = `${review.caseId}:${review.reviewerId}`;
    if (!validCaseIds.includes(review.caseId) || !review.reviewerId?.trim() || !Number.isFinite(Date.parse(review.reviewedAt)) ||
      !Number.isFinite(review.matchScore) || review.matchScore < 0 || review.matchScore > 100 || keys.has(key)) {
      throw new Error('Invalid, duplicate or unknown human annotation; supply caseId, reviewerId, reviewedAt and a score from 0 to 100.');
    }
    keys.add(key);
  }
  return document.reviews;
}
module.exports = { evaluateCase, summarize, validateReviews, validCitation, citedValue, setCounts, prf };
