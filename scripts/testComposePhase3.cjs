const assert = require('node:assert/strict');
module.exports = async ({ request, finished, resumeId, workspaceId }) => {
  const facts = (await request('POST', '/evidence/sync', { resumeId })).data; assert(facts.length > 0); assert(facts.every((item) => item.verification === 'confirmed'));
  const form = new FormData(); form.append('file', new Blob(['I personally implemented Python validation, documented error responses and tested recovery before importing fictional course data.']), 'container-project-evidence.txt');
  const preview = (await request('POST', '/evidence/imports/document', form, 201)).data;
  const candidate = preview.candidates[0];
  const imported = (await request('POST', '/evidence/imports/' + preview._id + '/confirm', { revision: 1, confirmFacts: true, context: { section: 'projects', entryId: 'container-project', recordId: String(resumeId) }, items: [{ candidateId: candidate.id, title: 'Container project contribution', statement: candidate.statement, kind: 'achievement', technologies: ['Python'], measurement: 'unknown', measurementNotes: '' }] })).data;
  const planned = (await request('POST', '/evidence/copilot', { workspaceId, scope: 'projects:container-project' }, 202)).data;
  let output = (await finished(planned.jobId)).output;
  if (output.copilotRun.status === 'needs_input') {
    const resumed = (await request('POST', '/evidence/copilot/' + output.copilotRun._id + '/answers', { revision: output.copilotRun.revision, confirmFacts: true, answers: output.copilotRun.questions.map((question) => ({ questionId: question.id, text: question.required ? candidate.statement : '' })) }, 202)).data;
    output = (await finished(resumed.jobId)).output;
  }
  assert.equal(output.copilotRun.status, 'draft_ready'); assert(output.copilotRun.trace.length <= 8);
  const url = '/resumes/' + resumeId + '/versions/' + output.tailoredResume._id + '/evidence';
  const report = (await request('GET', url)).data; assert(report.summary.cited > 0); assert(report.claims.some((claim) => claim.citations.some((citation) => citation.evidenceId === imported.items[0]._id)));
  const pdf = await request('GET', '/resumes/' + resumeId + '/download/' + output.tailoredResume._id + '?preview=1'); assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
  await request('POST', '/evidence/' + imported.items[0]._id + '/archive', { revision: imported.items[0].revision });
  assert((await request('GET', url)).data.claims.every((claim) => claim.citations.every((citation) => citation.evidenceId !== imported.items[0]._id)));
  console.log('PASS Phase 3 separate worker plans, imports confirmed evidence, rewrites one project, cites facts and rechecks archived evidence');
  return { runId: output.copilotRun._id, resumeId };
};
