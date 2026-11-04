#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { performance } = require('node:perf_hooks');
const DeterministicProvider = require('../src/providers/deterministicProvider');
const { assessMatch } = require('../src/services/requirementMatching');
const { rubricVersion } = require('../src/services/assessmentRubrics');
const { evaluateCase, summarize, validateReviews } = require('../evaluation/metrics.cjs');
const implementationFiles = [
  '../src/providers/deterministicProvider.js', '../src/providers/resumeContact.js', '../src/providers/resumeFacts.js',
  '../src/providers/resumeEvidence.js', '../src/providers/skillPolarity.js', '../src/providers/skillConflicts.js',
  '../src/services/jobRequirements.js', '../src/services/requirementMatching.js', '../src/services/assessmentRubrics.js',
];

function argumentsFor(argv) {
  const result = { splits: ['development'], output: null, human: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--all') result.splits = ['development', 'holdout'];
    else if (argv[i] === '--holdout') result.splits = ['holdout'];
    else if (['--output', '--human'].includes(argv[i])) {
      const key = argv[i].slice(2), value = argv[++i];
      if (!value || value.startsWith('--')) throw new Error(`--${key} requires a path`);
      result[key] = value;
    } else throw new Error(`Unknown option: ${argv[i]}`);
  }
  return result;
}

async function run(options) {
  const provider = new DeterministicProvider();
  const loaded = options.splits.map(split => {
    const filename = path.join(__dirname, '../evaluation/dataset/v1', split + '.json');
    const content = fs.readFileSync(filename);
    return { ...JSON.parse(content), sha256: crypto.createHash('sha256').update(content).digest('hex') };
  });
  const datasetVersion = loaded[0].datasetVersion;
  const allCases = loaded.flatMap(dataset => dataset.cases);
  const reviews = options.human ? validateReviews(JSON.parse(fs.readFileSync(path.resolve(options.human), 'utf8')), {
    datasetVersion, rubricVersion, validCaseIds: allCases.map(item => item.id),
  }) : [];
  // Warm up independently of the fixture set; do not train or tune from holdout data.
  const warmup = await provider.parseResume('Example Candidate\nSkills\nHTML');
  assessMatch({ resumeData: warmup, jobDescriptionText: 'Required: HTML.' });
  const splits = {};
  for (const dataset of loaded) {
    const cases = [];
    for (const fixture of dataset.cases) {
      const start = performance.now();
      const parsed = await provider.parseResume(fixture.resumeText);
      const match = assessMatch({ resumeData: parsed, jobDescriptionText: fixture.jobDescriptionText, targetRole: fixture.targetRole });
      cases.push(evaluateCase(fixture, parsed, match, performance.now() - start));
    }
    splits[dataset.split] = { datasetSha256: dataset.sha256, annotationScope: dataset.annotationScope,
      metrics: summarize(cases, reviews), byGroup: Object.fromEntries([...new Set(cases.map(item => item.group))].map(group => [group, summarize(cases.filter(item => item.group === group), reviews)])), cases };
  }
  return { reportVersion: 'phase4-evaluation-v2', generatedAt: new Date().toISOString(), datasetVersion, rubricVersion,
    runtime: { node: process.version, platform: process.platform, architecture: process.arch },
    implementationFiles,
    implementationSha256: crypto.createHash('sha256').update(implementationFiles.map(filename => fs.readFileSync(path.join(__dirname, filename), 'utf8')).join('\n')).digest('hex'),
    datasetUsage: Object.fromEntries(loaded.map(dataset => [dataset.split, dataset.split === 'holdout' ? 'published-holdout-regression' : 'development-regression'])),
    method: 'Published synthetic raw-text fixtures → deterministic parser → local versioned requirement matcher. One timed pipeline sample per case after independent warmup.',
    limitations: [
      'Synthetic reference labels were authored independently of application output, not provided by independent human reviewers.',
      'Skill extraction and classification are measured; the initial gold set does not measure experience/constraint correctness, OCR, visual layout or actual job performance.',
      'Holdout is separately stored but small and template-related to development; no population confidence interval or real hiring outcome is established.',
      'This dataset and its initial holdout results are published. Reruns are regression checks, not fresh unseen holdout evidence.',
      'Citation integrity checks the parsed data path and exact quote, while unsupported claims compare the matching decision with raw-input reference labels.',
      'This run does not measure live LLM accuracy, latency, token consumption, queue/API latency or provider pricing.',
    ], splits };
}

async function main() {
  const options = argumentsFor(process.argv.slice(2));
  const report = await run(options);
  if (options.output) {
    const destination = path.resolve(options.output);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, JSON.stringify(report, null, 2) + '\n');
  }
  process.stdout.write(JSON.stringify({ datasetVersion: report.datasetVersion, rubricVersion: report.rubricVersion,
    splits: Object.fromEntries(Object.entries(report.splits).map(([name, split]) => [name, split.metrics])), output: options.output }, null, 2) + '\n');
}
if (require.main === module) main().catch(error => { process.stderr.write(error.message + '\n'); process.exitCode = 1; });
module.exports = { argumentsFor, run };
