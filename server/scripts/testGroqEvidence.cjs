// Invoked only by the opt-in live runner; career inputs remain fictional.
const assert = require('node:assert/strict');
module.exports = async ({ request, successfulJob, check, resumeId, report, publicRepo }) => {
  const latest = (await request('GET', '/api/resumes/' + resumeId)).data.data;
  const content = require('../src/services/resumeContent').cleanResumeContent(latest.parsedData);
  content.projects.push({ entryId: 'live-copilot-project', title: 'Fictional course importer', description: 'Course importer.', technologies: ['Python'], highlights: [], link: '' });
  const saved = await request('PUT', '/api/resumes/' + resumeId + '/content', { revision: latest.contentRevision || 1, title: 'Fictional verified evidence resume', content, revisionName: 'Verified copilot fixture' }); assert.equal(saved.status, 200);
  // Normal tailoring collected these facts before source verification. Collection
  // intentionally preserves their states, so explicitly confirm the fixture facts.
  const collected = (await request('POST', '/api/evidence/sync', { resumeId })).data.data;
  for (const fact of collected.filter((item) => item.verification !== 'confirmed')) assert.equal((await request('POST', '/api/evidence/' + fact._id + '/verification', { revision: fact.revision, verification: 'confirmed' })).status, 200);
  const before = report.actions.length;
  const first = await successfulJob(await request('POST', '/api/evidence/copilot', { resumeId, targetRole: 'Backend Engineer', scope: 'projects:live-copilot-project', jobDescriptionText: 'Python validation and clear input error handling required.' }));
  assert.equal(first.copilotRun.status, 'needs_input'); assert.equal(report.actions.length, before);
  check('Copilot requests targeted clarification without an AI call');
  const contribution = 'I personally implemented Python validation, displayed field errors and documented recovery steps before importing fictional course data.';
  const output = await successfulJob(await request('POST', '/api/evidence/copilot/' + first.copilotRun._id + '/answers', { revision: first.copilotRun.revision, confirmFacts: true, answers: first.copilotRun.questions.map((question) => ({ questionId: question.id, text: question.required ? contribution : '' })) }));
  assert.equal(output.copilotRun.status, 'draft_ready', JSON.stringify(output.copilotRun.trace)); assert.equal(output.aiProvider, 'groq'); assert.equal(output.copilotRun.trace.length, 8);
  assert(output.copilotRun.answers.some((answer) => answer.skipped && answer.text === ''));
  assert.deepEqual(output.tailoredResume.tailoredContent.workExperience.map((entry) => entry.highlights), content.workExperience.map((entry) => entry.highlights));
  const fresh = (await request('GET', '/api/resumes/' + resumeId)).data.data;
  assert.equal(fresh.parsedData.projects.at(-1).description, 'Course importer.'); assert.equal(fresh.parsedData.projects.at(-1).highlights.length, 0);
  const evidence = await request('GET', '/api/resumes/' + resumeId + '/versions/' + output.tailoredResume._id + '/evidence');
  assert.equal(evidence.status, 200); assert(evidence.data.data.claims.some((claim) => claim.path[0] === 'projects' && claim.citations.some((citation) => citation.quote === contribution)));
  check('Groq copilot draft is entry-scoped, cited and preserves the source', { planningSteps: 8, citedStatements: evidence.data.data.summary.cited });
  const pdf = await request('GET', '/api/resumes/' + resumeId + '/download/' + output.tailoredResume._id + '?preview=1'); assert.equal(pdf.status, 200);
  const parsed = await require('../src/agents/parserAgent').extractTextFromBuffer(pdf.data, 'pdf'); assert(parsed.includes('Fictional course importer')); assert(parsed.includes('Example University'));
  await require('node:fs/promises').writeFile(require('node:path').resolve(__dirname, '../../.test-tmp/groq-evidence-copilot.pdf'), pdf.data);
  check('Evidence-backed copilot PDF retains scoped contribution and other qualifications');
  if (publicRepo) {
    const canonical = require('../src/services/evidenceImportService').repository('https://github.com/' + publicRepo);
    const preview = await request('POST', '/api/evidence/imports/github', { url: canonical.url, confirmOwnership: true }); assert.equal(preview.status, 201, preview.data.message);
    assert.equal(preview.data.data.metadata.ownership, 'user-attested'); assert(preview.data.data.text.trim());
    assert.equal((await request('DELETE', '/api/evidence/imports/' + preview.data.data._id)).status, 200);
    check('Public GitHub project preview uses live metadata and is discarded without AI sharing', { repository: publicRepo });
  }
};
