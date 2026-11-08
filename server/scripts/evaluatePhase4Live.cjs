#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { performance } = require('node:perf_hooks');
const { setTimeout: delay } = require('node:timers/promises');
const { cases: interviewCases, referenceProvenance } = require('../evaluation/liveInterviewCases.cjs');

const endpoint = 'https://api.groq.com/openai/v1/chat/completions';
const maxRequests = 20;
const resumeIds = ['graduate-01', 'experienced-01', 'sparse-05', 'formatting-04', 'formatting-06', 'misleading-03', 'misleading-05', 'misleading-06'];
const prices = {
  'openai/gpt-oss-120b': { input: 0.15, cachedInput: 0.075, output: 0.60,
    source: 'https://console.groq.com/docs/model/openai/gpt-oss-120b', verifiedOn: '2026-11-08' },
};
const duration = start => Number((performance.now() - start).toFixed(3));
const tokens = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
const digest = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const percentile = (list, p) => list.length ? [...list].sort((a, b) => a - b)[Math.ceil(list.length * p) - 1] : null;

function resetMilliseconds(value) {
  const units = { ms: 1, s: 1000, m: 60000, h: 3600000 };
  return [...String(value || '').matchAll(/(\d+(?:\.\d+)?)(ms|s|m|h)/g)]
    .reduce((sum, part) => sum + Number(part[1]) * units[part[2]], 0);
}

function responseUsage(value) {
  if (!value) return null;
  const inputTokens = tokens(value.prompt_tokens), outputTokens = tokens(value.completion_tokens);
  if (inputTokens === null || outputTokens === null) return null;
  return { inputTokens, outputTokens, cachedInputTokens: tokens(value.prompt_tokens_details?.cached_tokens) };
}

function estimatedCost(call) {
  const price = prices[call.responseModel];
  if (!call.usage || !price) return null;
  const cached = Math.min(call.usage.inputTokens, call.usage.cachedInputTokens ?? 0);
  return Number((((call.usage.inputTokens - cached) * price.input + cached * price.cachedInput
    + call.usage.outputTokens * price.output) / 1e6).toFixed(9));
}

function failureKind(error) {
  const status = error.response?.status;
  if (Number.isInteger(status)) return `HTTP ${status}`;
  if (error.code === 'BENCHMARK_LIMIT') return 'request-cap';
  if (error.message?.startsWith('Invalid provider schema')) return 'invalid-schema';
  if (error.message?.startsWith('Invalid JSON')) return 'invalid-json';
  if (error.message?.startsWith('Empty response')) return 'empty-response';
  if (/timed out/i.test(error.message || '')) return 'timeout';
  return error.code && /^[A-Z0-9_]{1,40}$/.test(error.code) ? error.code : 'request-or-evaluation-error';
}

function summarizeRun(report, summarize) {
  const accepted = report.cases.filter(item => item.status === 'accepted');
  const resume = accepted.filter(item => item.action === 'parseResume').map(item => item.measurement);
  const interviews = accepted.filter(item => item.action === 'evaluateAnswer');
  const { extractionAccuracy, requirementStatusAccuracy, unsupportedClaimRate, citationIntegrity, evidenceCoverage } = summarize(resume);
  const availableUsage = report.requests.filter(call => call.usage);
  const priced = report.requests.filter(call => call.estimatedUsd !== null);
  return {
    requestedCases: report.plannedCases,
    attemptedCases: report.cases.length,
    acceptedCases: accepted.length,
    failedCases: report.cases.length - accepted.length,
    unattemptedCases: report.plannedCases - report.cases.length,
    physicalRequests: report.requests.length,
    successfulHttpResponses: report.requests.filter(call => call.httpStatus >= 200 && call.httpStatus < 300).length,
    acceptedActionLatencyMs: Object.fromEntries(['parseResume', 'evaluateAnswer'].map(action => {
      const samples = accepted.filter(item => item.action === action).map(item => item.latencyMs);
      return [action, { samples: samples.length, p50: percentile(samples, .50), p95: percentile(samples, .95) }];
    })),
    tokenUsage: { reportedRequests: availableUsage.length,
      inputTokens: availableUsage.reduce((sum, call) => sum + call.usage.inputTokens, 0),
      cachedInputTokens: availableUsage.some(call => call.usage.cachedInputTokens !== null)
        ? availableUsage.reduce((sum, call) => sum + (call.usage.cachedInputTokens ?? 0), 0) : null,
      outputTokens: availableUsage.reduce((sum, call) => sum + call.usage.outputTokens, 0) },
    cost: { mode: 'published-rate-estimate', pricedRequests: priced.length, actualInvoicedUsd: null,
      estimatedUsdForPricedRequests: priced.length ? Number(priced.reduce((sum, call) => sum + call.estimatedUsd, 0).toFixed(9)) : null },
    resume: { acceptedCases: resume.length, extractionAccuracy, requirementStatusAccuracy, unsupportedClaimRate, citationIntegrity, evidenceCoverage,
      rawResumeQuoteCoverage: {
        correct: accepted.filter(item => item.action === 'parseResume').reduce((sum, item) => sum + item.rawResumeQuotes.correct, 0),
        total: accepted.filter(item => item.action === 'parseResume').reduce((sum, item) => sum + item.rawResumeQuotes.total, 0),
      } },
    interview: { acceptedCases: interviews.length,
      technicalBandCorrect: interviews.filter(item => item.technicalBandCorrect).length,
      expectedBranchCorrect: interviews.filter(item => item.expectedBranchCorrect).length,
      jointCorrect: interviews.filter(item => item.technicalBandCorrect && item.expectedBranchCorrect).length },
  };
}

async function run(output) {
  const axios = require('axios');
  const GroqProvider = require('../src/providers/groqProvider');
  const { validateResult } = require('../src/providers/validateResult');
  const { assessMatch } = require('../src/services/requirementMatching');
  const { rubricVersion } = require('../src/services/assessmentRubrics');
  const { selectFollowUp, policyVersion } = require('../src/services/adaptiveInterview');
  const { SKILLS, normalizeSkill } = require('../src/providers/resumeFacts');
  const { evaluateCase, summarize, setCounts } = require('../evaluation/metrics.cjs');
  const sourceFile = require.resolve('../evaluation/dataset/v1/development.json');
  const development = require(sourceFile);
  const resumeCases = resumeIds.map(id => development.cases.find(item => item.id === id));
  if (resumeCases.some(item => item?.provenance?.kind !== 'synthetic' || item.provenance.personalData !== 'fictional')) {
    throw new Error('Live benchmark requires the named fictional resume fixtures.');
  }
  const provider = new GroqProvider();
  const safeModel = value => typeof value === 'string' && /^[A-Za-z0-9._/-]{1,100}$/.test(value) && !value.includes(provider.apiKey || '\0') ? value : null;
  const report = {
    reportVersion: 'phase4-live-validation-v1', startedAt: new Date().toISOString(), state: 'started',
    provider: provider.name, configuredModel: safeModel(provider.model), timeoutMs: provider.timeoutMs,
    rubricVersion, policyVersion, dataScope: 'Fictional text only', datasetVersion: development.datasetVersion,
    runnerSha256: digest(__filename),
    adapterSha256: digest(require.resolve('../src/providers/chatCompletionProvider')),
    followUpPolicySha256: digest(require.resolve('../src/services/adaptiveInterview')),
    resumeFixtureSha256: digest(sourceFile), interviewFixtureSha256: digest(require.resolve('../evaluation/liveInterviewCases.cjs')),
    interviewReferenceProvenance: referenceProvenance, plannedCases: resumeCases.length + interviewCases.length,
    requestCap: maxRequests, priceBasisUsdPerMillionTokens: prices,
    runtime: { node: process.version, platform: process.platform, arch: process.arch },
    cases: [], requests: [],
  };
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  const save = () => fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  if (!provider.isAvailable()) {
    report.state = 'blocked';
    report.stopReason = 'Groq credential unavailable';
    report.summary = summarizeRun(report, summarize);
    save();
    return report;
  }

  const originalPost = axios.post;
  let current, stopReason, waitUntil = 0;
  axios.post = async (url, body, config) => {
    if (url !== endpoint || !current) throw new Error('Unexpected benchmark network destination.');
    if (report.requests.length >= maxRequests) {
      const error = new Error('Benchmark request cap reached.');
      error.code = 'BENCHMARK_LIMIT';
      throw error;
    }
    const started = performance.now();
    const call = { caseId: current.id, action: current.action, httpStatus: null, responseModel: null, usage: null };
    try {
      const response = await originalPost(url, body, { ...config, maxRedirects: 0 });
      call.httpStatus = response.status;
      call.responseModel = safeModel(response.data?.model);
      call.usage = responseUsage(response.data?.usage);
      const remaining = Number(response.headers['x-ratelimit-remaining-tokens']);
      const reset = resetMilliseconds(response.headers['x-ratelimit-reset-tokens']);
      if (remaining < 2500 && reset > 0 && reset <= 60000) waitUntil = Date.now() + reset + 200;
      return response;
    } catch (error) {
      const status = error.response?.status;
      call.httpStatus = Number.isInteger(status) ? status : null;
      call.failure = failureKind(error);
      call.usage = responseUsage(error.response?.data?.usage);
      call.responseModel = safeModel(error.response?.data?.model);
      const retrySeconds = Number(error.response?.headers?.['retry-after']);
      if (status === 429 && retrySeconds > 0 && retrySeconds <= 60) waitUntil = Date.now() + retrySeconds * 1000 + 200;
      else if ([401, 403, 404, 407, 429].includes(status) || !error.response) stopReason = call.failure;
      throw error;
    } finally {
      call.latencyMs = duration(started);
      call.estimatedUsd = estimatedCost(call);
      report.requests.push(call);
      save();
    }
  };

  const allowedSkills = new Set(SKILLS.map(normalizeSkill));
  const clean = value => String(value || '').replaceAll(provider.apiKey, '[REDACTED]')
    .replace(/\b(?:gsk_|sk-)[A-Za-z0-9_-]{12,}/g, '[REDACTED]').slice(0, 1800);
  const normalizedQuote = value => String(value || '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
  const measureResume = (fixture, parsed, latencyMs) => {
    const match = assessMatch({ resumeData: parsed, jobDescriptionText: fixture.jobDescriptionText, targetRole: fixture.targetRole });
    const measurement = evaluateCase(fixture, parsed, match, latencyMs);
    const actual = parsed.skills.all.filter(skill => allowedSkills.has(normalizeSkill(skill)));
    const expected = fixture.expectedExtraction.skills.map(normalizeSkill);
    measurement.resumeSkills = setCounts(expected, actual.map(normalizeSkill));
    measurement.failures.unexpectedSkills = actual.filter(skill => !expected.includes(normalizeSkill(skill))).map(clean);
    const rows = match.requirementMatches.map(row => ({
      label: clean(row.label), category: row.category, status: row.status,
      supportingEvidence: (row.supportingEvidence || []).map(({ path, quote }) => ({ path, quote: clean(quote) })),
      conflictingEvidence: (row.conflictingEvidence || []).map(({ path, quote }) => ({ path, quote: clean(quote) })),
    }));
    const quotes = rows.flatMap(row => [...row.supportingEvidence, ...row.conflictingEvidence]).map(item => normalizedQuote(item.quote));
    return { measurement, parsedContacts: { name: clean(parsed.contactInfo.name), email: clean(parsed.contactInfo.email) },
      dictionarySkills: actual.map(clean), outOfDictionarySkills: parsed.skills.all.filter(skill => !allowedSkills.has(normalizeSkill(skill))).map(clean),
      rawResumeQuotes: { correct: quotes.filter(quote => quote && normalizedQuote(fixture.resumeText).includes(quote)).length, total: quotes.length }, rows };
  };
  const measureInterview = (fixture, feedback) => {
    const followUp = selectFollowUp({ ...fixture.question, _id: fixture.id, order: 1, userAnswer: fixture.answer, feedback });
    const [minimum, maximum] = fixture.expected.technicalBand;
    return { expected: fixture.expected,
      scores: Object.fromEntries(['technicalScore', 'overallScore', 'clarityScore', 'relevanceScore', 'structureScore'].map(key => [key, feedback[key]])),
      feedback: { comments: clean(feedback.comments), strengths: feedback.strengths.map(clean), improvements: feedback.improvements.map(clean) },
      observedBranch: followUp.adaptation.kind, followUpQuestion: clean(followUp.questionText),
      technicalBandCorrect: feedback.technicalScore >= minimum && feedback.technicalScore <= maximum,
      expectedBranchCorrect: followUp.adaptation.kind === fixture.expected.branch };
  };

  try {
    const tasks = [
      ...resumeCases.map(fixture => ({ fixture, action: 'parseResume', params: fixture.resumeText })),
      ...interviewCases.map(fixture => ({ fixture, action: 'evaluateAnswer', params: {
        question: fixture.question, userAnswer: fixture.answer, suggestedAnswer: fixture.question.suggestedAnswer, targetRole: 'Software Engineer',
      } })),
    ];
    for (const { fixture, action, params } of tasks) {
      if (stopReason || report.requests.length >= maxRequests) break;
      if (waitUntil > Date.now()) await delay(waitUntil - Date.now());
      current = { id: fixture.id, action };
      const started = performance.now();
      let result;
      try {
        const response = validateResult(action, await provider[action](params), params);
        const latencyMs = duration(started);
        const measured = action === 'parseResume' ? measureResume(fixture, response, latencyMs) : measureInterview(fixture, response);
        result = { ...current, status: 'accepted', latencyMs, ...measured };
      } catch (error) {
        result = { ...current, status: 'failed', latencyMs: duration(started), failure: failureKind(error) };
      }
      report.cases.push(result);
      save();
      console.log(JSON.stringify({ caseId: result.id, status: result.status, latencyMs: result.latencyMs, failure: result.failure }));
    }
  } finally {
    axios.post = originalPost;
  }
  report.state = report.cases.length === report.plannedCases ? 'completed' : 'partial';
  report.stopReason = stopReason || (report.cases.length < report.plannedCases ? 'request-cap' : null);
  report.completedAt = new Date().toISOString();
  report.summary = summarizeRun(report, summarize);
  save();
  return report;
}

async function main(argv) {
  if (argv.length !== 3 || argv[0] !== '--live' || argv[1] !== '--output' || !argv[2]) {
    throw new Error('Usage: node server/scripts/evaluatePhase4Live.cjs --live --output <new report path>');
  }
  const report = await run(path.resolve(argv[2]));
  console.log(JSON.stringify({ state: report.state, stopReason: report.stopReason, summary: report.summary }, null, 2));
  if (report.state !== 'completed' || report.summary.failedCases) process.exitCode = 1;
}

if (require.main === module) main(process.argv.slice(2)).catch(error => {
  // Report safe categories only. Request errors can hold authorization headers.
  console.error(error.code === 'EEXIST' ? 'Output already exists. Choose a new report path.'
    : error.message?.startsWith('Usage:') ? error.message : `Live benchmark stopped: ${failureKind(error)}`);
  process.exitCode = 1;
});
