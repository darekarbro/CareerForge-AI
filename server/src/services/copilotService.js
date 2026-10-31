const Run = require('../models/CopilotRun');
const library = require('./evidenceService');
const { fail, text, revision, cleanResumeContent } = require('./resumeContent');
const { plain } = require('../providers/resumeFacts');
const structure = require('./resumeStructure');
const { createJob, dispatchJob } = require('./jobService');
const MAX_STEPS = 8;
async function get(id, owner) { const run = await Run.findOne({ _id: id, owner }); if (!run) throw fail('Copilot run not found', 404); return run; }
function questions(content) {
  const result = [];
  for (const section of ['projects', 'workExperience']) for (const entry of content[section] || []) {
    const label = entry.title || [entry.role, entry.company].filter(Boolean).join(' at '), context = { section, entryId: entry.entryId };
    const contribution = [entry.description, ...(entry.highlights || [])].filter(Boolean).join(' ');
    if (contribution.split(/\s+/).length < 12) result.push({ id: section + '_' + entry.entryId + '_contribution', kind: 'responsibility', context, title: label, prompt: 'For ' + label + ', what did you personally implement, investigate or deliver?', required: true });
    if (/\d/.test(contribution)) result.push({ id: section + '_' + entry.entryId + '_measurement', kind: 'achievement', context, title: label, prompt: 'For ' + label + ', how was the stated result measured? If unknown, leave this blank.', required: false, measurement: true });
    else if (contribution.split(/\s+/).length < 30) result.push({ id: section + '_' + entry.entryId + '_outcome', kind: 'achievement', context, title: label, prompt: 'For ' + label + ', what outcome can you verify? Leave unknown outcomes blank; a number is not required.', required: false });
  }
  return [...result.filter((question) => question.required), ...result.filter((question) => !question.required)].slice(0, 8);
}
async function start(owner, input) {
  if (Object.keys(input).some((key) => !['resumeId', 'targetRole', 'jobDescriptionText', 'workspaceId', 'scope'].includes(key))) throw fail('Unsupported copilot option');
  let resumeId = input.resumeId, targetRole = text(input.targetRole, 'Target role', 120), jobDescriptionText = text(input.jobDescriptionText, 'Job description', 24000), workspace;
  if (input.workspaceId) { workspace = await require('./workspaceService').inputs(input.workspaceId, owner); resumeId = workspace.resumeId; targetRole = workspace.targetRole; jobDescriptionText = workspace.jobDescriptionText; }
  if (!targetRole) throw fail('Choose a target role');
  if (!/^[a-fA-F0-9]{24}$/.test(String(resumeId || ''))) throw fail('Choose a valid source resume');
  const resume = await require('./resumeService').getReadyResume(resumeId, owner), content = structure.selectedContent(resume, workspace?.resumeSelection);
  const scope = structure.rewriteScope(input.scope, content);
  const run = await Run.create({ owner, resumeId: resume._id, workspaceId: input.workspaceId, workspaceRevision: workspace?.workspaceRevision, scope, targetRole, jobDescriptionText, sourceRevision: resume.contentRevision || 1 });
  try { return await dispatch(run, owner, { sourceSnapshot: content, rewriteScope: scope, sourceRevision: resume.contentRevision || 1, targetRole, jobDescriptionText, presentation: structure.presentation(resume.presentation), workspaceRevision: workspace?.workspaceRevision }); }
  catch (error) { await Run.deleteOne({ _id: run._id, owner }); throw error; }
}
async function dispatch(run, owner, rawInput) {
  const job = await createJob({ userId: owner, jobType: 'resume_copilot', inputRef: { resumeId: run.resumeId, copilotId: run._id, workspaceId: run.workspaceId, workspaceRevision: rawInput.workspaceRevision, targetRole: run.targetRole, rawInput } });
  await Run.updateOne({ _id: run._id, owner }, { $set: { jobId: job._id, status: 'planning' } });
  return { ...await dispatchJob(job), runId: run._id };
}
async function process(execution) {
  const { job, checkpoint, commit } = execution, run = await get(job.inputRef.copilotId, job.owner), input = job.inputRef.rawInput;
  const trace = run.clarified ? plain(run.trace || []) : [], step = async (action, reason, evidenceIds = []) => {
    if (trace.length >= MAX_STEPS) throw fail('Copilot action limit reached', 409);
    trace.push({ action, reason, evidenceIds, at: new Date() });
    await require('../agents/monitoringAgent').logEvent({ jobId: job._id, userId: job.owner, agent: 'copilot', step: 'copilot_' + action, message: reason, metadata: { evidenceIds, actionNumber: trace.length, actionLimit: MAX_STEPS } });
    await checkpoint();
  };
  const existing = await require('../models/TailoredResume').findOne({ processingJobId: job._id, owner: job.owner });
  if (existing) return commit(async () => { await require('./workspaceService').link(job, { $set: { latestVersionId: existing._id } }); const completed = await Run.findOneAndUpdate({ _id: run._id, owner: job.owner }, { $set: { status: 'draft_ready', versionId: existing._id } }, { new: true }); return { copilotRun: completed, tailoredResume: existing }; });
  const resume = await require('./resumeService').getReadyResume(run.resumeId, job.owner), source = structure.withEntryIds(input.sourceSnapshot);
  await step('inspect', 'Inspect the saved source and selected entries before generating new wording.');
  const sourceRecords = await library.syncResume(job.owner, resume, source, input.sourceRevision);
  const scope = run.scope || 'all', focus = structure.scopedContent(source, scope), baseFacts = library.facts(focus);
  const entryContexts = ['workExperience', 'projects'].flatMap((section) => focus[section].map((entry) => ({ section, entryId: entry.entryId })));
  const ids = entryContexts.map((entry) => entry.entryId);
  const retrievalQuery = library.tokens(run.targetRole + ' ' + input.jobDescriptionText).join(' ').slice(0, 1500);
  const retrieval = await library.retrieve(job.owner, retrievalQuery, { entryIds: ids, entryContexts, resumeId: run.resumeId, limit: 30 });
  await step('retrieve', 'Retrieve confirmed facts within the selected experience and project scope.', retrieval.map((item) => item.id));
  const evidenceSnapshot = [...new Map([...sourceRecords.map(library.snapshot), ...retrieval].map((item) => [item.id, item])).values()], confirmed = evidenceSnapshot.filter((item) => item.verification === 'confirmed');
  input.baseSourceSnapshot = plain(source);
  for (const section of ['workExperience', 'projects']) for (const entry of source[section]) {
    const additions = confirmed.filter((item) => item.context?.entryId === entry.entryId && item.context?.section === section && item.source?.kind !== 'resume' && item.statement.length <= 1800);
    entry.highlights = [...new Set([...(entry.highlights || []), ...additions.map((item) => item.statement)])];
    if (section === 'projects') entry.technologies = [...new Set([...(entry.technologies || []), ...additions.flatMap((item) => item.technologies)])];
  }
  // Only explicitly confirmed, scoped statements enrich a snapshot; source records stay unchanged.
  const pending = scope === 'summary' ? [] : questions(structure.scopedContent(source, scope)).map((question) => ({ ...question, context: { ...question.context, recordId: String(run.resumeId) } }));
  if (!run.clarified && pending.length) {
    await step('clarify', 'Ask for personal contributions and measurement context. Unknown outcomes may stay empty.');
    return commit(async () => ({ copilotRun: await Run.findOneAndUpdate({ _id: run._id, owner: job.owner }, { $set: { status: 'needs_input', questions: pending, trace, retrieval }, $inc: { revision: 1 } }, { new: true }) }));
  }
  const unresolved = (scope === 'summary' ? [] : questions(structure.scopedContent(source, scope))).filter((question) => question.required);
  if (!resume.verifiedAt || sourceRecords.filter((item) => !item.context?.entryId || entryContexts.some((entry) => entry.entryId === item.context.entryId && entry.section === item.context.section)).some((item) => item.verification !== 'confirmed') || baseFacts.some((fact) => !sourceRecords.some((item) => item.statement === fact.statement && item.context?.section === fact.context?.section && item.context?.entryId === fact.context?.entryId)) || !confirmed.length || unresolved.length) {
    await step('review', 'There is not enough confirmed personal contribution to rewrite safely. Add or confirm evidence, then start a new run.');
    return commit(async () => ({ copilotRun: await Run.findOneAndUpdate({ _id: run._id, owner: job.owner }, { $set: { status: 'review_recommended', trace, retrieval }, $inc: { revision: 1 } }, { new: true }) }));
  }
  try { input.sourceSnapshot = cleanResumeContent(source); }
  catch (error) { await step('review', 'The combined evidence exceeds an editable resume limit. Reduce selected facts before rewriting. ' + error.message); return commit(async () => ({ copilotRun: await Run.findOneAndUpdate({ _id: run._id, owner: job.owner }, { $set: { status: 'review_recommended', trace, retrieval }, $inc: { revision: 1 } }, { new: true }) })); }
  input.evidenceSnapshot = evidenceSnapshot;
  input.rewriteScope = scope;
  await step('rewrite', scope === 'all' ? 'Generate one resume draft from the confirmed source snapshot; keep changes for user review.' : 'Rewrite only the selected section or entry and preserve the rest of the resume.', confirmed.map((item) => item.id).slice(0, 50));
  return require('./tailoringService').processTailoring({ ...execution, commit: async (write) => {
    await step('validate', 'Check each claim against its own entry and attach supporting evidence. Unsupported wording is withheld.');
    await step('review', 'Recommend individual review of the new draft and its evidence. No source profile or resume is overwritten.');
    return commit(async () => { const output = await write(); const completed = await Run.findOneAndUpdate({ _id: run._id, owner: job.owner }, { $set: { status: 'draft_ready', versionId: output.tailoredResume._id, trace, retrieval }, $inc: { revision: 1 } }, { new: true }); return { ...output, copilotRun: completed }; });
  } });
}
async function answer(id, owner, input) {
  const run = await get(id, owner);
  if (Object.keys(input).some((key) => !['revision', 'answers', 'confirmFacts'].includes(key)) || input.confirmFacts !== true || !Array.isArray(input.answers) || input.answers.length > 8) throw fail('Confirm the facts you provide. Unknown answers may stay empty.');
  if (run.status !== 'needs_input' || run.revision !== revision(input.revision)) throw fail('This copilot run changed elsewhere. Reload it.', 409);
  const seen = new Set(), answers = input.answers.map((answer) => {
    if (!answer || Object.keys(answer).some((key) => !['questionId', 'text'].includes(key)) || seen.has(answer.questionId)) throw fail('Answer each displayed question at most once');
    const question = run.questions.find((item) => item.id === answer.questionId); if (!question) throw fail('Question not found in this run'); seen.add(answer.questionId);
    const value = text(answer.text, 'Clarification answer', 1500); return { question, text: /^(?:unknown|not sure|n\/a|i (?:don't|do not) know|not measured)[.!]?$/i.test(value) ? '' : value };
  });
  const resume = await require('./resumeService').getReadyResume(run.resumeId, owner);
  if ((resume.contentRevision || 1) !== run.sourceRevision) throw fail('The resume changed since these questions. Start a new copilot run with the latest facts.', 409);
  let workspace; if (run.workspaceId) { workspace = await require('./workspaceService').inputs(run.workspaceId, owner); if (String(workspace.resumeId) !== String(run.resumeId) || workspace.workspaceRevision !== run.workspaceRevision) throw fail('The job workspace changed. Start a new copilot run with its latest inputs.', 409); }
  const claimed = await Run.findOneAndUpdate({ _id: id, owner, revision: input.revision, status: 'needs_input' }, { $set: { status: 'planning', clarified: true, answers: answers.map((item) => ({ questionId: item.question.id, text: item.text, skipped: !item.text })) }, $inc: { revision: 1 } }, { new: true });
  if (!claimed) throw fail('This run is already continuing. Reload it.', 409);
  try {
    for (const answer of answers.filter((item) => item.text)) await require('../models/CareerEvidence').findOneAndUpdate({ owner, key: 'clarification:' + id + ':' + answer.question.id }, { $setOnInsert: { owner, key: 'clarification:' + id + ':' + answer.question.id, kind: answer.question.kind, title: answer.question.title, statement: answer.text, context: answer.question.context, technologies: require('../providers/resumeFacts').extractSkills(answer.text), verification: 'confirmed', confirmedAt: new Date(), measurement: answer.question.measurement ? 'measured' : /\d/.test(answer.text) ? 'reported' : 'unknown', measurementNotes: answer.question.measurement ? answer.text : '', source: { kind: 'clarification', quote: answer.text, label: 'User-confirmed clarification' } } }, { upsert: true });
    return await dispatch(claimed, owner, { sourceSnapshot: structure.selectedContent(resume, workspace?.resumeSelection), rewriteScope: run.scope || 'all', sourceRevision: run.sourceRevision, targetRole: run.targetRole, jobDescriptionText: workspace?.jobDescriptionText || run.jobDescriptionText || '', presentation: structure.presentation(resume.presentation), workspaceRevision: workspace?.workspaceRevision });
  } catch (error) { await Run.updateOne({ _id: id, owner, revision: claimed.revision }, { $set: { status: 'needs_input' } }); throw error; }
}
module.exports = { start, process, answer, get, questions, MAX_STEPS };
