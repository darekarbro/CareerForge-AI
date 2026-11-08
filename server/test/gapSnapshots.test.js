const test = require('node:test');
const assert = require('node:assert/strict');
const Gap = require('../src/models/GapAnalysis');
const Description = require('../src/models/JobDescription');
const resumes = require('../src/services/resumeService');
const analyzer = require('../src/agents/analyzerAgent');
const workspaces = require('../src/services/workspaceService');
const service = require('../src/services/gapAnalysisService');

test('Phase 4: gap reports retain the analyzed snapshot revision after later resume edits', async (t) => {
  const snapshot = { summary: 'Original Python project.' }, current = { summary: 'Edited Rust project.' };
  const resume = { _id: 'resume-id', contentRevision: 4, parsedData: current };
  const saved = [];
  let analyzed;
  t.mock.method(Gap, 'findOne', async () => null);
  t.mock.method(Gap, 'create', async (value) => { const result = { ...value, _id: 'gap-id' }; saved.push(result); return result; });
  t.mock.method(resumes, 'getReadyResume', async () => resume);
  t.mock.method(analyzer, 'analyzeGap', async (input) => { analyzed = input.resumeData; return { matchScore: 0, requirements: {}, aiProvider: 'deterministic-fallback' }; });
  t.mock.method(Description, 'findOneAndUpdate', async () => ({ _id: 'jd-id', rawText: 'Python required' }));
  t.mock.method(Description, 'updateOne', async () => ({}));
  t.mock.method(workspaces, 'link', async () => {});
  const run = (rawInput) => service.processAnalysis({ job: { _id: 'job-id', owner: 'owner-id', inputRef: { resumeId: resume._id, rawInput: {
    jobDescriptionText: 'Python required', targetRole: 'Engineer', ...rawInput,
  } } }, checkpoint: async () => {}, commit: (write) => write() });

  await run({ sourceSnapshot: snapshot, sourceRevision: 2 });
  assert.deepEqual(analyzed, snapshot);
  assert.equal(saved.at(-1).sourceRevision, 2);
  await run({});
  assert.deepEqual(analyzed, current);
  assert.equal(saved.at(-1).sourceRevision, 4);
  await run({ sourceSnapshot: snapshot });
  assert.equal(saved.at(-1).sourceRevision, undefined, 'legacy snapshot revision cannot be inferred from the edited resume');
});
