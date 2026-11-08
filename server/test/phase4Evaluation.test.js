const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateCase, summarize, validateReviews, validCitation } = require('../evaluation/metrics.cjs');
const { argumentsFor, run } = require('../scripts/evaluatePhase4.cjs');

const fixture = { id: 'example-01', group: 'misleading', expectedExtraction: { contactInfo: { name: 'Test Candidate', email: '' }, skills: ['Python'] },
  expectedRequirements: [{ category: 'requiredSkills', label: 'Python', status: 'supported' }, { category: 'preferredSkills', label: 'React', status: 'missing' }] };
const parsed = { contactInfo: { name: 'Test Candidate', email: '' }, skills: { all: ['Python', 'React'] } };
const match = { matchScore: 90, requirementMatches: [
  { category: 'required_skill', label: 'Python', status: 'supported', supportingEvidence: [{ path: 'skills.all[0]', quote: 'Python' }] },
  { category: 'preferred_skill', label: 'React', status: 'supported', supportingEvidence: [{ path: 'skills.all[1]', quote: 'React' }] },
] };

test('evaluation distinguishes valid parsed citations from false supported claims against original-input labels', () => {
  const result = summarize([evaluateCase(fixture, parsed, match, 5)]);
  assert.equal(result.extractionAccuracy.resumeSkills.precision, .5);
  assert.equal(result.extractionAccuracy.resumeSkills.recall, 1);
  assert.equal(result.extractionAccuracy.contactExact.rate, 1);
  assert.equal(result.extractionAccuracy.jdSkills.f1, 1);
  assert.equal(result.requirementStatusAccuracy.rate, .5);
  assert.equal(result.unsupportedClaimRate.rate, .5);
  assert.equal(result.citationIntegrity.rate, 1);
  assert.equal(result.evidenceCoverage.supportedClaimCoverage, 1);
  assert.equal(result.humanScoreAgreement.status, 'not-measured');
  assert.equal(result.humanScoreAgreement.meanAbsoluteError, null);
});

test('missing/invalid evidence cannot inflate evidence coverage and undefined denominators stay null', () => {
  const result = summarize([evaluateCase(fixture, parsed, { matchScore: 0, requirementMatches: [
    { category: 'required_skill', label: 'Python', status: 'supported', supportingEvidence: [{ path: 'skills.all[0]', quote: 'Fabricated' }] },
  ] })]);
  assert.equal(result.evidenceCoverage.supportedClaimCoverage, 0);
  assert.equal(result.citationIntegrity.rate, 0);
  assert.equal(summarize([]).unsupportedClaimRate.rate, null);
  assert.equal(validCitation(parsed, { path: '__proto__.toString', quote: 'something' }), false);
  assert.equal(validCitation(parsed, { path: 'skills.all[99]', quote: 'Python' }), false);
});

test('human scoring uses independent supplied review means per case and rejects incompatible annotations', () => {
  const document = { datasetVersion: 'dataset-v1', rubricVersion: 'rubric-v1', annotationMethod: 'independent-human-review', reviews: [
    { caseId: 'example-01', reviewerId: 'reviewer-one', reviewedAt: '2026-01-01T12:00:00Z', matchScore: 60 },
    { caseId: 'example-01', reviewerId: 'reviewer-two', reviewedAt: '2026-01-01T12:00:00Z', matchScore: 80 },
  ] };
  const context = { datasetVersion: 'dataset-v1', rubricVersion: 'rubric-v1', validCaseIds: ['example-01'] };
  const reviews = validateReviews(document, context);
  const result = summarize([evaluateCase(fixture, parsed, match)], reviews);
  assert.equal(result.humanScoreAgreement.reviewedCases, 1);
  assert.equal(result.humanScoreAgreement.meanAbsoluteError, 20);
  assert.equal(result.humanScoreAgreement.withinTenPointsRate, 0);
  assert.throws(() => validateReviews({ ...document, rubricVersion: 'old' }, context));
  assert.throws(() => validateReviews({ ...document, reviews: [document.reviews[0], document.reviews[0]] }, context));
  assert.throws(() => validateReviews({ ...document, reviews: [{ ...document.reviews[0], matchScore: 101 }] }, context));
});

test('evaluation defaults to development; holdout requires an explicit option', () => {
  assert.deepEqual(argumentsFor([]).splits, ['development']);
  assert.deepEqual(argumentsFor(['--holdout']).splits, ['holdout']);
  assert.deepEqual(argumentsFor(['--all']).splits, ['development', 'holdout']);
  assert.throws(() => argumentsFor(['--output']));
  assert.throws(() => argumentsFor(['--unknown']));
  assert.equal(argumentsFor([]).datasetVersion, 'v1');
  for (const version of ['v2', 'v3', 'v4']) {
    assert.equal(argumentsFor(['--dataset-version', version, '--holdout']).datasetVersion, version);
    assert.throws(() => argumentsFor(['--dataset-version', version]));
    assert.throws(() => argumentsFor(['--dataset-version', version, '--all']));
    assert.throws(() => argumentsFor(['--dataset-version', version, '--holdout', '--first-pass', 'lock.json']));
    assert.throws(() => argumentsFor(['--dataset-version', version, '--holdout', '--first-pass', 'lock.json', '--output', 'report.json', '--human', 'reviews.json']));
    assert.equal(argumentsFor(['--dataset-version', version, '--holdout', '--first-pass', 'lock.json', '--output', 'report.json']).firstPass, 'lock.json');
  }
  assert.throws(() => argumentsFor(['--dataset-version', '../v1', '--holdout']));
  assert.throws(() => argumentsFor(['--first-pass', 'lock.json', '--output', 'report.json']));
  assert.throws(() => argumentsFor(['--dataset-version', 'v5', '--holdout']));
});

test('evaluation provenance includes contact parsing and labels published data as regression evidence', async () => {
  const report = await run(argumentsFor([]));
  const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
  assert(report.implementationFiles.includes('../src/providers/resumeContact.js'));
  for (const file of ['resumeEvidence.js', 'skillPolarity.js', 'skillConflicts.js', 'resumeClaims.js', 'resumeLayout.js']) assert(report.implementationFiles.includes('../src/providers/' + file));
  const source = report.implementationFiles.map((file) => fs.readFileSync(path.resolve(__dirname, '../scripts', file), 'utf8')).join('\n');
  assert.equal(report.implementationSha256, crypto.createHash('sha256').update(source).digest('hex'));
  assert.deepEqual(report.datasetUsage, { development: 'development-regression' });
  assert.equal(report.splits.holdout, undefined);
  assert(report.limitations.some((line) => line.includes('not fresh unseen holdout evidence')));
});

test('denial citations are measured without counting them as supported-skill coverage', () => {
  const data = { ...parsed, summary: 'I do not know React.' };
  const report = { matchScore: 0, requirementMatches: [{ category: 'preferred_skill', label: 'React', status: 'uncertain', supportingEvidence: [{ path: 'skills.all[1]', quote: 'React' }], conflictingEvidence: [{ path: 'summary', quote: 'Fabricated denial' }] }] };
  const metrics = summarize([evaluateCase(fixture, data, report)]);
  assert.equal(metrics.citationIntegrity.valid, 1); assert.equal(metrics.citationIntegrity.total, 2); assert.equal(metrics.citationIntegrity.rate, .5);
  assert.equal(metrics.evidenceCoverage.supported, 0); assert.equal(metrics.evidenceCoverage.supportedClaimCoverage, null);
});
