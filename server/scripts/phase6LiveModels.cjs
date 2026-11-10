// Explicit live calibration, fictional inputs only; separate from approval for app traffic.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
if (!process.argv.includes('--live')) { console.error('Use --live to authorize a maximum $0.20 reservation and 40 attempts using fictional data.'); process.exit(1); }
const credentials = require('dotenv').parse(fs.readFileSync(path.join(root, 'server/.env')));
const key = credentials.GROQ_API_KEY;
require('../test/setup.cjs');
process.env.GROQ_API_KEY = key || ''; process.env.GROQ_TIMEOUT_MS = '30000';
process.env.USER_DAILY_BUDGET_MICROUSD = '200000';
const env = require('../src/config/env');
const mongoose = require('mongoose');
const candidates = [
  { provider: 'groq', model: 'openai/gpt-oss-120b', inputUsdPerMillion: 0.15, outputUsdPerMillion: 0.60, maxInputBytes: 65536, maxOutputTokens: 4096 },
  { provider: 'groq', model: 'openai/gpt-oss-20b', inputUsdPerMillion: 0.075, outputUsdPerMillion: 0.30, maxInputBytes: 65536, maxOutputTokens: 4096 },
];
const output = path.resolve(root, process.argv.find((arg) => arg.startsWith('--output='))?.slice(9) || '.test-tmp/phase6-live-models.json');
const report = { version: 1, startedAt: new Date().toISOString(), runtime: process.version, scope: 'fictional frozen Phase 4 development and interview fixtures; no human pilot or holdout claim',
  protocol: { candidates, attemptsLimit: 40, reservationLimitUsd: 0.20, qualityGate: 0.9, priceVerifiedOn: '2026-11-10',
    priceSources: ['https://console.groq.com/docs/model/openai/gpt-oss-120b', 'https://console.groq.com/docs/model/openai/gpt-oss-20b'],
    selectionMetric: 'minimum of extraction field accuracy and joint interview band/branch accuracy; failed cases count against acceptance; quality >= 0.90',
    automaticProductionApproval: false }, models: [] };
let directory;
const save = () => { fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, JSON.stringify(report, null, 2)); };
(async () => {
  if (!process.version.startsWith('v24.')) throw new Error('Use supported Node 24');
  if (!key || /^(your_|replace_|placeholder)/i.test(key)) throw new Error('Groq credential unavailable');
  directory = fs.mkdtempSync(path.join(root, '.test-tmp/phase6-calibration-'));
  const binaryPath = path.join(root, 'server/node_modules/.cache/mongodb-memory-server/mongod-x64-win32-7.0.24.exe');
  await require('../src/config/db').connectDB({ memoryOptions: { binary: fs.existsSync(binaryPath) ? { systemBinary: binaryPath } : {}, instance: { dbPath: directory } } });
  const account = await require('../src/models/User').create({ name: 'Fictional calibration account', email: 'phase6-calibration@example.test', password: crypto.randomBytes(24).toString('hex'), emailVerifiedAt: new Date(), privacy: { providers: { groq: true } } });
  save();
  await require('../src/services/operationalControls').withCalibration({ owner: account._id, candidates, requestLimit: 40 }, async () => {
    for (const candidate of candidates) {
      env.GROQ_MODEL = candidate.model;
      const filename = 'phase6-live-' + candidate.model.split('/')[1] + '-' + Date.now() + '.json';
      const run = await require('./evaluatePhase4Live.cjs').run(path.join(root, '.test-tmp', filename));
      const extraction = run.summary.extractionAccuracy;
      const interview = run.summary.interview;
      const extractionScore = Math.min(extraction.contactExact.rate ?? 0, extraction.resumeSkills.f1 ?? 0);
      const plannedInterviews = run.plannedCases - 8;
      const qualityScore = Math.min(extractionScore, interview.jointCorrect / plannedInterviews) * (run.summary.acceptedCases / run.plannedCases);
      report.models.push({ model: candidate.model, reportFile: filename, report: run, qualityScore,
        passesQualityGate: run.state === 'completed' && qualityScore >= report.protocol.qualityGate });
      save();
    }
  });
  const ledger = await require('../src/models/UsageBudget').findOne({ owner: account._id }).lean();
  report.reservedUsd = (ledger?.reservedMicrousd || 0) / 1000000; report.debitedAttempts = ledger?.attempts || 0;
  report.eligibleModels = report.models.filter((row) => row.passesQualityGate).map((row) => row.model);
  report.state = report.models.every((row) => row.report.state === 'completed') ? 'completed' : 'partial';
  report.completedAt = new Date().toISOString();
})().catch((error) => { report.state = 'failed'; report.failure = typeof error.code === 'string' ? error.code : 'CALIBRATION_FAILURE'; report.reason = String(error.message).replaceAll(key || 'NO_CREDENTIAL', '[REDACTED]').slice(0, 300); console.error(report.failure, report.reason); process.exitCode = 1; }).finally(async () => {
  await require('../src/config/db').disconnectDB(); await require('../src/services/telemetry').shutdown();
  save(); if (directory && path.resolve(directory).startsWith(path.join(root, '.test-tmp') + path.sep)) fs.rmSync(directory, { recursive: true, force: true });
  console.log(JSON.stringify({ state: report.state, models: report.models.map((row) => ({ model: row.model, qualityScore: row.qualityScore, passed: row.passesQualityGate })), reservedUsd: report.reservedUsd, output }));
});
