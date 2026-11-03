module.exports = ({ test, assert, request, user, ready, facts, successfulJob, Resume, Tailored }) => {
  const library = require('../src/services/evidenceService'), claims = require('../src/services/claimEvidenceService');
  const Evidence = require('../src/models/CareerEvidence'), Source = require('../src/models/EvidenceSource'), Run = require('../src/models/CopilotRun'), Job = require('../src/models/ProcessingJob');
  const structure = require('../src/services/resumeStructure');
  const fact = (context = {}, changes = {}) => ({ kind: 'achievement', title: 'Confirmed contribution', statement: 'I implemented Python validation for fictional course imports.', technologies: ['Python'], context, verification: 'confirmed', measurement: 'unknown', measurementNotes: '', ...changes });
  const rich = 'I implemented Python validation for fictional course imports and documented malformed input handling before accepting files. I tested recovery paths, reviewed the error messages and described the validation contract for the project in written notes.';

  test('Phase 3 readiness: material evidence edits invalidate snapshots while verification-only updates remain usable', async () => {
    const a = await user(), record = await library.save(a.id, fact()), snapshot = library.snapshot(record);
    await library.verify(record._id, a.id, { revision: 1, verification: 'unverified' }); await library.verify(record._id, a.id, { revision: 2, verification: 'confirmed' });
    assert.equal((await claims.refresh(a.id, [snapshot]))[0].verification, 'confirmed');
    await library.save(a.id, { ...fact(), revision: 3, technologies: ['Rust'], measurement: 'measured', measurementNotes: 'Changed measurement context.' }, record._id);
    assert.equal((await claims.refresh(a.id, [snapshot]))[0].stale, true);
  });
  test('Phase 3 readiness: historical withheld suggestions cannot retain revoked citations', async () => {
    const a = await user(), resume = await ready(a.id), source = structure.withEntryIds(resume.parsedData);
    const record = await library.save(a.id, fact({ section: 'projects', entryId: source.projects[0].entryId, recordId: String(resume._id) })), snapshot = library.snapshot(record);
    const version = await Tailored.create({ owner: a.id, resumeId: resume._id, targetRole: 'Engineer', version: 1, sourceContent: source, tailoredContent: source, evidenceSnapshot: [snapshot], claimEvidence: [{ path: ['projects', 0, 'description'], status: 'withheld', text: source.projects[0].description, withheldText: 'Led 25 Python developers.', citations: [{ evidenceId: snapshot.id, verification: 'confirmed' }] }] });
    await library.archive(record._id, a.id, { revision: 1 }); const report = await claims.version(a.id, version);
    assert.equal(report.historical, 1); assert(report.claims.every((claim) => claim.citations.every((citation) => citation.evidenceId !== snapshot.id))); assert(report.claims.some((claim) => claim.withheldText === 'Led 25 Python developers.'));
  });
  test('Phase 3 readiness: partially written imports survive failure and recover without duplicate or premature evidence', async () => {
    const a = await user(), b = await user(), form = new FormData();
    form.append('file', new Blob(['I built Python validation for course imports.\nI documented Python error recovery for the same project.']), 'recoverable-project.txt');
    const preview = (await request('POST', '/api/evidence/imports/document', { token: a.token, body: form })).data.data;
    const body = { revision: preview.revision, confirmFacts: true, context: {}, items: preview.candidates.map((candidate) => ({ candidateId: candidate.id, ...fact({}, { title: candidate.title, statement: candidate.statement, kind: 'project' }) })).map(({ verification, context, ...item }) => item) };
    const bulk = Evidence.bulkWrite;
    Evidence.bulkWrite = async function (operations) { await bulk.call(this, operations.slice(0, 1)); throw new Error('Synthetic database interruption'); };
    try { const response = await request('POST', '/api/evidence/imports/' + preview._id + '/confirm', { token: a.token, body }); assert.equal(response.status, 503); assert.equal(response.data.code, 'IMPORT_PENDING'); }
    finally { Evidence.bulkWrite = bulk; }
    assert.equal(await Evidence.countDocuments({ owner: a.id }), 1); assert.deepEqual(await library.retrieve(a.id, 'Python'), []);
    const partial = await Evidence.findOne({ owner: a.id }); assert.equal((await claims.refresh(a.id, [library.snapshot(partial)]))[0].stale, true);
    const pending = (await request('GET', '/api/evidence', { token: a.token })).data.data.pendingImports; assert.equal(pending.length, 1);
    assert.deepEqual((await request('GET', '/api/evidence', { token: b.token })).data.data.pendingImports, []);
    const retry = { revision: pending[0].revision, confirmFacts: true, retry: true };
    assert.equal((await request('POST', '/api/evidence/imports/' + preview._id + '/confirm', { token: b.token, body: retry })).status, 404);
    const exported = await request('POST', '/api/privacy/export', { token: a.token, body: { password: 'original-password', includeOriginals: false } });
    const zip = await require('jszip').loadAsync(exported.data), data = JSON.parse(await zip.file('account-data.json').async('string')); assert.equal(data.records.EvidenceSource[0].pendingImport.length, 2);
    const result = await request('POST', '/api/evidence/imports/' + preview._id + '/confirm', { token: a.token, body: retry }); assert.equal(result.status, 200); assert.equal(result.data.data.items.length, 2); assert.equal(result.data.data.source.importPending, false);
    assert.equal((await Source.findById(preview._id).select('+pendingImport')).pendingImport, undefined); assert.equal(await Evidence.countDocuments({ owner: a.id }), 2); assert.equal((await library.retrieve(a.id, 'Python')).length, 2);
    assert.equal((await request('POST', '/api/evidence/imports/' + preview._id + '/confirm', { token: a.token, body: retry })).status, 200); assert.equal(await Evidence.countDocuments({ owner: a.id }), 2);
  });
  test('Phase 3 readiness: old snapshots and enriched version facts cannot inherit a newer source verification', async () => {
    const a = await user(), resume = await ready(a.id), original = structure.withEntryIds(resume.parsedData);
    resume.parsedData.projects[0].description = rich; resume.contentRevision = 2; resume.verifiedAt = new Date(); await resume.save();
    const historical = await library.syncResume(a.id, resume, original, 1); assert(historical.every((item) => item.verification === 'unverified'));
    const enriched = structure.withEntryIds(resume.parsedData), additional = 'I measured 25 successful Python imports in a separate verification exercise.'; enriched.projects[0].highlights.push(additional);
    const collected = await library.syncResume(a.id, resume, enriched, 2); assert.equal(collected.find((item) => item.statement === additional).verification, 'unverified'); assert.equal(collected.find((item) => item.statement === rich).verification, 'confirmed');
  });
  test('Phase 3 readiness: saved import manifests recover after a restart and tolerate concurrent retries', async () => {
    const a = await user(), source = new Source({ owner: a.id, kind: 'document', title: 'Interrupted import', text: rich, confirmedAt: new Date(), revision: 2, importPending: true, expiresAt: undefined });
    source.pendingImport = [0, 1].map((index) => ({ owner: a.id, key: 'import:' + source._id + ':fact-' + index, ...fact({}, { statement: 'I tested Python recovery case ' + index + '.' }), source: { kind: 'document', sourceId: source._id, quote: rich, label: source.title } })); await source.save();
    const imports = require('../src/services/evidenceImportService'), input = { revision: 2, confirmFacts: true, retry: true };
    const results = await Promise.allSettled([imports.confirm(source._id, a.id, input), imports.confirm(source._id, a.id, input)]); assert(results.some((item) => item.status === 'fulfilled')); assert(results.every((item) => item.status === 'fulfilled' || item.reason.statusCode === 503));
    const result = await imports.confirm(source._id, a.id, input); assert.equal(result.items.length, 2); assert.equal(result.source.importPending, false); assert.equal(await Evidence.countDocuments({ owner: a.id }), 2);
  });
  test('Phase 3 readiness: clarification respects library capacity without consuming its pending answers', async () => {
    const a = await user(), resume = await ready(a.id); resume.verifiedAt = new Date(); await resume.save();
    const initial = await successfulJob(await request('POST', '/api/evidence/copilot', { token: a.token, body: { resumeId: resume._id, targetRole: 'Engineer' } })), run = initial.copilotRun;
    const count = await Evidence.countDocuments({ owner: a.id });
    await Evidence.insertMany(Array.from({ length: 4000 - count }, (_, index) => ({ owner: a.id, key: 'capacity:' + index, ...fact() })));
    const result = await request('POST', '/api/evidence/copilot/' + run._id + '/answers', { token: a.token, body: { revision: run.revision, confirmFacts: true, answers: run.questions.map((question) => ({ questionId: question.id, text: question.required ? rich : '' })) } });
    assert.equal(result.status, 409); assert.match(result.data.message, /capacity/); assert.equal(await Evidence.countDocuments({ owner: a.id }), 4000); const saved = await Run.findById(run._id); assert.equal(saved.status, 'needs_input'); assert.equal(saved.revision, run.revision);
  });
  test('Phase 3 readiness: stale queued source and workspace inputs stop before collecting facts or calling AI', async () => {
    const a = await user(), resume = await ready(a.id), copilot = require('../src/services/copilotService'), factory = require('../src/providers/providerFactory'), execute = factory.execute;
    const source = structure.withEntryIds(resume.parsedData); resume.contentRevision = 2; resume.verifiedAt = new Date(); await resume.save();
    const run = await Run.create({ owner: a.id, resumeId: resume._id, sourceRevision: 1, targetRole: 'Engineer', scope: 'summary' });
    const job = await Job.create({ owner: a.id, jobType: 'resume_copilot', status: 'RUNNING', inputRef: { resumeId: resume._id, copilotId: run._id, rawInput: { sourceSnapshot: source, sourceRevision: 1, targetRole: 'Engineer' } } });
    factory.execute = async () => { throw new Error('Stale inputs must not call AI'); };
    try { const result = await copilot.process({ job, checkpoint: async () => {}, commit: (write) => write() }); assert.equal(result.copilotRun.status, 'review_recommended'); assert.match(result.copilotRun.trace.at(-1).reason, /source resume changed/i); }
    finally { factory.execute = execute; }
    assert.equal(await Evidence.countDocuments(), 0); assert.equal(await Tailored.countDocuments(), 0);
    const workspace = (await request('POST', '/api/workspaces', { token: a.token, body: { company: 'Example', title: 'Engineer', description: 'Python required', resumeId: resume._id } })).data.data;
    const other = await Run.create({ owner: a.id, resumeId: resume._id, sourceRevision: 2, workspaceId: workspace._id, workspaceRevision: 1, targetRole: 'Engineer', scope: 'summary' });
    await require('../src/models/JobWorkspace').updateOne({ _id: workspace._id }, { $set: { preparationRevision: 2 } });
    job.inputRef.copilotId = other._id; const result = await copilot.process({ job, checkpoint: async () => {}, commit: (write) => write() }); assert.equal(result.copilotRun.status, 'review_recommended'); assert.match(result.copilotRun.trace.at(-1).reason, /workspace changed/i);
  });
  test('Phase 3 readiness: edits during generation discard the draft before it is committed', async () => {
    const a = await user(), resume = await ready(a.id), generator = require('../src/agents/generatorAgent'), original = generator.tailorResume;
    resume.verifiedAt = new Date(); await resume.save();
    generator.tailorResume = async (...args) => { const result = await original.apply(generator, args); await Resume.updateOne({ _id: resume._id }, { $set: { contentRevision: 2, verifiedAt: null } }); return result; };
    try { const result = await successfulJob(await request('POST', '/api/evidence/copilot', { token: a.token, body: { resumeId: resume._id, targetRole: 'Engineer', scope: 'summary' } })); assert.equal(result.copilotRun.status, 'review_recommended'); assert.equal(result.tailoredResume, undefined); assert.equal(await Tailored.countDocuments(), 0); }
    finally { generator.tailorResume = original; }
  });
  test('Phase 3 readiness: removed source facts stay out of new copilot retrieval while library history is preserved', async () => {
    const a = await user(), resume = await ready(a.id); resume.verifiedAt = new Date(); resume.parsedData.projects[0].description = rich; resume.parsedData.projects[0].highlights.push('I tested Python validation with 25 fictional users.'); await resume.save();
    const old = (await library.syncResume(a.id, resume)).find((item) => item.statement.includes('25 fictional'));
    resume.parsedData.projects[0].highlights = ['Tested Python integration.']; resume.contentRevision = 2; await resume.save();
    const scope = 'projects:' + structure.withEntryIds(resume.parsedData).projects[0].entryId;
    const result = await successfulJob(await request('POST', '/api/evidence/copilot', { token: a.token, body: { resumeId: resume._id, targetRole: 'Python Engineer', scope } }));
    assert.equal(result.copilotRun.status, 'draft_ready'); assert(result.copilotRun.retrieval.every((item) => item.id !== String(old._id))); assert(result.tailoredResume.evidenceSnapshot.every((item) => item.id !== String(old._id))); assert(await Evidence.findById(old._id));
  });
  test('Phase 3 readiness: copilot history exposes terminal job failures instead of endless planning', async () => {
    const a = await user(), resume = await ready(a.id), run = await Run.create({ owner: a.id, resumeId: resume._id, targetRole: 'Engineer' });
    const job = await Job.create({ owner: a.id, jobType: 'resume_copilot', status: 'FAILED', inputRef: { copilotId: run._id }, error: { code: 'SYNTHETIC', message: 'Synthetic provider outage' } }); await Run.updateOne({ _id: run._id }, { $set: { jobId: job._id } });
    const listed = (await request('GET', '/api/evidence/copilot', { token: a.token })).data.data; assert.equal(listed[0].jobStatus, 'FAILED'); assert.equal(listed[0].jobError, 'Synthetic provider outage');
  });
};
