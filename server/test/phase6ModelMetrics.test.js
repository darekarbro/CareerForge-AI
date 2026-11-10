const test = require('node:test');
const assert = require('node:assert/strict');
const { summarizeModel } = require('../evaluation/phase6ModelMetrics.cjs');
test('model comparison reads nested extraction metrics and penalizes rejected cases', () => {
  const run = { state: 'completed', plannedCases: 16, summary: { acceptedCases: 16,
    resume: { extractionAccuracy: { contactExact: { rate: 1 }, resumeSkills: { f1: 1 } } }, interview: { jointCorrect: 8 }, tokenUsage: { inputTokens: 1000, outputTokens: 500 } } };
  const candidate = { inputUsdPerMillion: 0.15, outputUsdPerMillion: 0.6 };
  assert.equal(summarizeModel(run, candidate).qualityScore, 1); assert.equal(summarizeModel(run, candidate).passesQualityGate, true);
  assert.equal(summarizeModel(run, candidate).tokenCostEstimateUsd, 0.00045);
  run.summary.acceptedCases = 12; assert.equal(summarizeModel(run, candidate).passesQualityGate, false);
  run.summary.resume.extractionAccuracy.resumeSkills.f1 = null; assert.equal(summarizeModel(run, candidate).qualityScore, 0);
});
