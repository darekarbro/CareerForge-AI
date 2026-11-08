#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const DeterministicProvider = require('../src/providers/deterministicProvider');
const { validateResult } = require('../src/providers/validateResult');
const { assessMatch } = require('../src/services/requirementMatching');
const { rubricVersion } = require('../src/services/assessmentRubrics');
const { selectFollowUp, policyVersion } = require('../src/services/adaptiveInterview');
const competency = require('../src/services/competencyService');
const learningPlan = require('../src/services/learningPlanService');
const { validCitation, prf } = require('../evaluation/metrics.cjs');
const { sha256 } = require('../evaluation/holdoutProtocol.cjs');

const fixturePath = path.resolve(__dirname, '../evaluation/dataset/expanded-v1.json');
const sourceFiles = [
  'providers/deterministicProvider.js', 'providers/offlineInterviewRubric.js', 'providers/validateResult.js', 'providers/resumeFacts.js',
  'providers/resumeEvidence.js', 'providers/resumeClaims.js', 'providers/skillPolarity.js',
  'providers/skillConflicts.js', 'services/jobRequirements.js', 'services/requirementMatching.js',
  'services/assessmentRubrics.js', 'services/adaptiveInterview.js', 'services/competencyService.js',
  'services/learningPlanService.js',
].map(file => `server/src/${file}`);
const tally = (correct, total) => ({ correct, total, rate: total ? correct / total : null });
const requirementKey = item => `${item.category}:${item.sourceText}`;
const sameValues = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function evaluateRequirements(fixture) {
  const result = assessMatch(fixture);
  const rows = result.requirementMatches.filter(row => ['experience', 'constraint'].includes(row.category));
  const references = new Map(fixture.expected.map(row => [requirementKey(row), row]));
  const predictions = new Map(rows.map(row => [requirementKey(row), row]));
  const expected = fixture.expected.map(({ category, sourceText, status, ...metadata }) => {
    const observed = predictions.get(requirementKey({ category, sourceText }));
    return { category, sourceText, status, ...metadata,
      extracted: Boolean(observed), observedStatus: observed?.status ?? null,
      metadataMatches: Boolean(observed) && Object.entries(metadata).every(([key, value]) => sameValues(observed[key], value)),
    };
  });
  const observed = rows.map(row => ({ category: row.category, sourceText: row.sourceText, status: row.status,
    ...(row.minimumYears !== undefined && { minimumYears: row.minimumYears, scopeSkills: row.scopeSkills, optional: row.optional }),
    referenceStatus: references.get(requirementKey(row))?.status ?? null,
    evidence: row.supportingEvidence.map(evidence => ({ ...evidence, valid: validCitation(fixture.resumeData, evidence) })),
  }));
  return { id: fixture.id, rationale: fixture.rationale, expected, observed };
}

function summarizeRequirements(cases, category) {
  const expected = cases.flatMap(item => item.expected).filter(row => row.category === category);
  const observed = cases.flatMap(item => item.observed).filter(row => row.category === category);
  const supported = observed.filter(row => row.status === 'supported');
  const citations = observed.flatMap(row => row.evidence);
  const truePositive = expected.filter(row => row.extracted).length;
  const numeric = expected.filter(row => row.minimumYears !== undefined);
  return { extraction: prf({ truePositive, falsePositive: observed.filter(row => row.referenceStatus === null).length,
    falseNegative: expected.length - truePositive }),
    statusAccuracy: tally(expected.filter(row => row.status === row.observedStatus).length, expected.length),
    numericMetadataAccuracy: tally(numeric.filter(row => row.metadataMatches).length, numeric.length),
    unsupportedSupported: { count: supported.filter(row => row.referenceStatus !== 'supported').length, total: supported.length },
    citationIntegrity: tally(citations.filter(item => item.valid).length, citations.length),
  };
}

function technicalBand(score) {
  if (score >= 75) return 'sound';
  if (score >= 40) return 'partial';
  return 'unsound';
}

async function evaluateInterviews(dataset, provider) {
  const answers = [];
  for (const fixture of dataset.answers) {
    const question = { ...dataset.questions[fixture.questionId], _id: fixture.id, order: 1 };
    const params = { question, userAnswer: fixture.userAnswer, suggestedAnswer: question.suggestedAnswer };
    const start = performance.now();
    const feedback = validateResult('evaluateAnswer', await provider.evaluateAnswer(params), params);
    const followUp = selectFollowUp({ ...question, userAnswer: fixture.userAnswer, feedback });
    answers.push({ id: fixture.id, questionId: fixture.questionId, rationale: fixture.rationale,
      expectedTechnical: fixture.expectedTechnical, expectedFollowUp: fixture.expectedFollowUp,
      technicalBand: technicalBand(feedback.technicalScore), feedback, followUp,
      latencyMs: Number((performance.now() - start).toFixed(4)),
    });
  }
  const byId = new Map(answers.map(answer => [answer.id, answer]));
  const contrasts = dataset.contrasts.map(pair => {
    const soundScore = byId.get(pair.soundAnswerId).feedback.technicalScore;
    const unsoundScore = byId.get(pair.unsoundAnswerId).feedback.technicalScore;
    const ordering = soundScore > unsoundScore ? 'correct' : soundScore === unsoundScore ? 'tied' : 'reversed';
    return { ...pair, soundScore, unsoundScore, ordering };
  });
  return { answers, contrasts, metrics: {
    technicalBandAgreement: tally(answers.filter(answer => answer.technicalBand === answer.expectedTechnical).length, answers.length),
    followUpAgreement: tally(answers.filter(answer => answer.followUp.adaptation.kind === answer.expectedFollowUp).length, answers.length),
    soundAboveUnsound: tally(contrasts.filter(pair => pair.ordering === 'correct').length, contrasts.length),
    unsoundSentDeeper: { count: answers.filter(answer => answer.expectedTechnical === 'unsound' && answer.followUp.adaptation.kind === 'deeper').length,
      total: answers.filter(answer => answer.expectedTechnical === 'unsound').length },
  } };
}

function evaluateProgress(fixture, interviewFixtures, evaluated) {
  const answers = new Map(interviewFixtures.answers.map(answer => [answer.id, answer]));
  const results = new Map(evaluated.answers.map(answer => [answer.id, answer]));
  const attempt = (id, day) => ({ userAnswer: answers.get(id).userAnswer, answeredAt: new Date(Date.UTC(2025, 0, day)).toISOString(),
    feedback: { ...results.get(id).feedback, aiProvider: 'deterministic-fallback' },
  });
  const questions = fixture.attempts.map((item, index) => ({
    ...interviewFixtures.questions[answers.get(item.currentAnswerId).questionId],
    _id: item.questionId, sessionId: item.sessionId, ...attempt(item.currentAnswerId, index + 2),
    attempts: item.previousAnswerId ? [attempt(item.previousAnswerId, index + 1)] : [],
  }));
  const profile = competency.buildProfile(questions);
  const reports = fixture.jobReports.map(report => ({ ...report, requirementMatches: assessMatch({
    resumeData: fixture.jobResumeData, jobDescriptionText: report.jobDescriptionText,
  }).requirementMatches }));
  const { current, excluded } = learningPlan.currentReports(reports, fixture.resumeRevisions);
  const plan = learningPlan.buildLearningPlan(profile, current);

  const topics = new Map(profile.competencies.map(topic => [topic.topic, topic]));
  const competencyResults = fixture.expectedCompetencies.map(expected => {
    const topic = topics.get(expected.topic);
    const fields = ['sampleCount', 'sessionCount', 'attemptCount'];
    const countsMatch = Boolean(topic) && fields.every(field => topic[field] === expected[field]);
    return { expected, observedStatus: topic?.status ?? null, countsMatch,
      averageScore: topic?.averageScore ?? null, evidence: topic?.evidence ?? [] };
  });
  const expectedLinks = new Set(questions.flatMap(question => Array.from({ length: question.attempts.length + 1 }, (_, attemptIndex) =>
    `/interview/session/${question.sessionId}?question=${question._id}&attempt=${attemptIndex}`)));
  const observedLinks = profile.competencies.flatMap(topic => topic.evidence.map(evidence => evidence.href));
  const currentRequirements = new Map(current.map(report => [String(report._id), new Set(report.requirementMatches.map(row => row.id))]));
  const observedRecommendations = plan.items.map(item => ({
    topic: item.topic, difficulty: item.reassessment.difficulty,
    evidenceKind: item.sourceEvidence.length ? 'interview' : item.requirementSources.length && item.confidence === 'unassessed' ? 'unassessed-job-gap' : 'unlinked',
    linked: (item.sourceEvidence.length + item.requirementSources.length > 0)
      && item.sourceEvidence.every(evidence => expectedLinks.has(evidence.href))
      && item.requirementSources.every(source => currentRequirements.get(source.analysisId)?.has(source.requirementId)),
    actionableStructure: item.practiceTasks.length === 2 && item.projectMilestones.length === 2
      && [...item.practiceTasks, ...item.projectMilestones].every(task => task.title && task.instructions && task.doneWhen)
      && item.reassessment.count === 3 && item.reassessment.topicFocus === item.topic && item.reassessment.successCriteria.length > 0,
    sourceEvidence: item.sourceEvidence, requirementSources: item.requirementSources,
    practiceTasks: item.practiceTasks, projectMilestones: item.projectMilestones, reassessment: item.reassessment,
  }));
  const expectedTopics = new Set(fixture.expectedRecommendations.map(item => item.topic));
  const observedByTopic = new Map(observedRecommendations.map(item => [item.topic, item]));
  const recommended = fixture.expectedRecommendations.map(expected => ({ expected, observed: observedByTopic.get(expected.topic) ?? null }));
  return { competencyResults, expectedExcludedReports: fixture.expectedExcludedReports, excludedReports: excluded,
    currentReportIds: current.map(report => report._id), recommended, observedRecommendations,
    unexpectedRecommendationTopics: observedRecommendations.filter(item => !expectedTopics.has(item.topic)).map(item => item.topic),
    metrics: {
      semanticCompetencyAgreement: tally(competencyResults.filter(item => item.expected.status === item.observedStatus).length, competencyResults.length),
      correctTopicHistoryCounts: tally(competencyResults.filter(item => item.countsMatch).length, competencyResults.length),
      attemptLinkCoverage: tally([...expectedLinks].filter(link => observedLinks.includes(link)).length, expectedLinks.size),
      reportExclusionsMatch: sameValues(excluded, fixture.expectedExcludedReports),
      expectedRecommendationTopicsFound: tally(recommended.filter(item => item.observed).length, recommended.length),
      alignedRecommendations: tally(recommended.filter(({ expected, observed }) => observed?.difficulty === expected.difficulty && observed.evidenceKind === expected.evidenceKind).length, recommended.length),
      recommendationsWithValidEvidenceLinks: tally(observedRecommendations.filter(item => item.linked).length, observedRecommendations.length),
      recommendationsWithActionableStructure: tally(observedRecommendations.filter(item => item.actionableStructure).length, observedRecommendations.length),
    },
  };
}

async function run() {
  const bytes = fs.readFileSync(fixturePath);
  const fixture = JSON.parse(bytes);
  const requirements = fixture.requirements.map(evaluateRequirements);
  const interview = await evaluateInterviews(fixture.interview, new DeterministicProvider());
  const progress = evaluateProgress(fixture.progress, fixture.interview, interview);
  const root = path.resolve(__dirname, '../..');
  const fingerprint = files => sha256(files.map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n'));
  return {
    reportVersion: 'phase4-expanded-validation-v1', generatedAt: new Date().toISOString(),
    runtime: { node: process.version, platform: process.platform, architecture: process.arch },
    datasetVersion: fixture.datasetVersion, datasetSha256: sha256(bytes), annotationMethod: fixture.annotationMethod,
    sourceFiles, implementationSha256: fingerprint(sourceFiles), evaluatorSha256: fingerprint([
      'server/scripts/evaluatePhase4Expanded.cjs', 'server/evaluation/metrics.cjs',
    ]),
    rubricVersion, followUpPolicyVersion: policyVersion, competencyVersion: competency.rubricVersion, learningPlanVersion: learningPlan.rubricVersion,
    execution: { mode: 'local deterministic functions', externalRequests: 0, billedTokens: 0, externalCostUsd: 0 },
    requirements: { metrics: Object.fromEntries(['experience', 'constraint'].map(category => [category, summarizeRequirements(requirements, category)])), cases: requirements },
    interview, progress,
  };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--output' || !args[1] || args[1].startsWith('--'))) {
    throw new Error('Usage: node server/scripts/evaluatePhase4Expanded.cjs [--output report.json]');
  }
  const report = await run();
  const json = JSON.stringify(report, null, 2) + '\n';
  if (args.length) {
    const output = path.resolve(args[1]);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, json, { flag: 'wx' });
    process.stdout.write(JSON.stringify({ requirements: report.requirements.metrics, interview: report.interview.metrics, progress: report.progress.metrics, output }, null, 2) + '\n');
  } else process.stdout.write(json);
}

if (require.main === module) main().catch(error => { process.stderr.write(error.message + '\n'); process.exitCode = 1; });
module.exports = { run };
