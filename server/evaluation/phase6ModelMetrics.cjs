const fs = require('node:fs');
const crypto = require('node:crypto');
function summarizeModel(run, candidate) {
  const extraction = run.summary.resume.extractionAccuracy;
  const extractionScore = Math.min(extraction.contactExact.rate ?? 0, extraction.resumeSkills.f1 ?? 0);
  const plannedInterviews = run.plannedCases - 8;
  const qualityScore = Math.min(extractionScore, run.summary.interview.jointCorrect / plannedInterviews) * (run.summary.acceptedCases / run.plannedCases);
  const usage = run.summary.tokenUsage;
  return { qualityScore, passesQualityGate: run.state === 'completed' && qualityScore >= 0.9,
    tokenCostEstimateUsd: (usage.inputTokens * candidate.inputUsdPerMillion + usage.outputTokens * candidate.outputUsdPerMillion) / 1000000,
    costBasis: 'all reported input at uncached published rate; output at published rate; not invoice' };
}
async function reconstructReservations(run, candidate) {
  // Resume only successful single-attempt calls with the identical source and fixtures.
  const digest = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  if (run.state !== 'completed' || run.adapterSha256 !== digest(require.resolve('../src/providers/chatCompletionProvider')) ||
    run.resumeFixtureSha256 !== digest(require.resolve('./dataset/v1/development.json')) ||
    run.interviewFixtureSha256 !== digest(require.resolve('./liveInterviewCases.cjs')) || run.requests.length !== run.cases.length ||
    run.cases.some((row) => row.status !== 'accepted') || run.requests.some((row) => row.httpStatus !== 200)) throw new Error('Saved run cannot be safely resumed under this source');
  const controls = require('../src/services/operationalControls'), call = controls.networkCall, policy = controls.policyFor;
  const provider = new (require('../src/providers/groqProvider'))(); provider.model = candidate.model;
  const resumes = require('./dataset/v1/development.json').cases, interviews = require('./liveInterviewCases.cjs').cases;
  let reservedMicrousd = 0, count = 0, maxObservedInputBytes = 0;
  controls.policyFor = () => candidate;
  controls.networkCall = async ({ body }) => {
    const bytes = Buffer.byteLength(JSON.stringify(body));
    maxObservedInputBytes = Math.max(maxObservedInputBytes, bytes);
    reservedMicrousd += Math.ceil((bytes + 1024) * candidate.inputUsdPerMillion + candidate.maxOutputTokens * candidate.outputUsdPerMillion); count++;
    throw Object.assign(new Error('Offline request reconstruction'), { code: 'OFFLINE_CAPTURE' });
  };
  try {
    for (const row of run.cases) {
      const fixture = row.action === 'parseResume' ? resumes.find((item) => item.id === row.id) : interviews.find((item) => item.id === row.id);
      if (!fixture) throw new Error('Saved fixture missing');
      const params = row.action === 'parseResume' ? fixture.resumeText : { question: fixture.question, userAnswer: fixture.answer, suggestedAnswer: fixture.question.suggestedAnswer, targetRole: 'Software Engineer' };
      try { await provider[row.action](params); throw new Error('Offline capture did not intercept transport'); }
      catch (error) { if (error.code !== 'OFFLINE_CAPTURE') throw error; }
    }
  } finally { controls.networkCall = call; controls.policyFor = policy; }
  if (count !== run.requests.length) throw new Error('Request reconstruction count changed');
  return { reservedMicrousd, attempts: count, maxObservedInputBytes, method: 'exact body reconstruction from matching adapter/fixture hashes and unchanged 4096-token cap; no additional network calls' };
}
module.exports = { summarizeModel, reconstructReservations };
