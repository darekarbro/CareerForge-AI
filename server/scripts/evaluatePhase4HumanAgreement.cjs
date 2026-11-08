#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { validateReviews, summarize } = require('../evaluation/metrics.cjs');
const { sha256 } = require('../evaluation/holdoutProtocol.cjs');

const root = path.resolve(__dirname, '../..');
const baselinePath = 'docs/PHASE4_V3_REGRESSION_V1_RESULTS.json';
const datasetPath = 'server/evaluation/dataset/v1/holdout.json';

function evaluateAgreement(document) {
  const baselineBytes = fs.readFileSync(path.join(root, baselinePath));
  const baseline = JSON.parse(baselineBytes);
  const holdout = baseline.splits.holdout;
  if (baseline.rubricVersion !== 'careerforge-assessment-v5' ||
      holdout.datasetSha256 !== sha256(fs.readFileSync(path.join(root, datasetPath)))) {
    throw new Error('The archived v5 scores must match the v1 holdout used in the reviewer packet.');
  }
  const validCaseIds = holdout.cases.map(item => item.id);
  const reviews = validateReviews(document, { datasetVersion: baseline.datasetVersion, rubricVersion: baseline.rubricVersion, validCaseIds });
  const reviewers = new Set(reviews.map(review => review.reviewerId.trim()));
  const complete = validCaseIds.every(id => new Set(reviews.filter(review => review.caseId === id).map(review => review.reviewerId.trim())).size === 2);
  if (reviewers.size !== 2 || reviews.length !== validCaseIds.length * 2 || !complete) {
    throw new Error('Supply two complete independent ballots with distinct reviewer IDs and one score per case.');
  }
  return {
    reportVersion: 'phase4-human-agreement-v1', generatedAt: new Date().toISOString(),
    datasetVersion: baseline.datasetVersion, rubricVersion: baseline.rubricVersion,
    datasetSha256: holdout.datasetSha256, baselinePath, baselineSha256: sha256(baselineBytes),
    humanScoreAgreement: summarize(holdout.cases, reviews).humanScoreAgreement,
  };
}

function main() {
  const [humanFlag, input, outputFlag, output, ...extra] = process.argv.slice(2);
  if (humanFlag !== '--human' || !input || outputFlag !== '--output' || !output || extra.length) {
    throw new Error('Usage: node server/scripts/evaluatePhase4HumanAgreement.cjs --human ballots.json --output new-report.json');
  }
  const report = evaluateAgreement(JSON.parse(fs.readFileSync(input, 'utf8')));
  fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  process.stdout.write(JSON.stringify(report.humanScoreAgreement, null, 2) + '\n');
}

if (require.main === module) {
  try { main(); }
  catch (error) { process.stderr.write(error.message + '\n'); process.exitCode = 1; }
}
module.exports = { evaluateAgreement };
