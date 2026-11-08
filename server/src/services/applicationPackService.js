const crypto = require('node:crypto');
const Pack = require('../models/ApplicationPack');
const { text, revision, fail } = require('./resumeContent');
const structure = require('./resumeStructure');
const { plain, resumeText, extractSkills } = require('../providers/resumeFacts');
const library = require('./evidenceService');
const kinds = ['coverLetter', 'recruiter', 'referral', 'followUp'];
const labels = { coverLetter: 'Cover letter', recruiter: 'Recruiter introduction', referral: 'Referral request', followUp: 'Application follow-up' };
const fingerprint = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');

async function context(id, owner) {
  const workspace = await require('./workspaceService').get(id, owner);
  if (!workspace.resumeId) throw fail('Choose and save a resume in this workspace before creating a preparation pack.');
  const resume = await require('./resumeService').getReadyResume(workspace.resumeId, owner);
  const selected = structure.selectedContent(resume, workspace.resumeSelection);
  // Sync preserves users' explicit rejection and edits. Only confirmed, current,
  // selected-entry facts are eligible for draft generation.
  await library.syncResume(owner, resume);
  const entries = ['workExperience', 'projects'].flatMap((section) => selected[section].map((entry) => ({ section, entryId: entry.entryId })));
  let evidence = await library.retrieve(owner, (workspace.title + ' ' + workspace.description).slice(0, 1500), {
    entryIds: entries.map((entry) => entry.entryId), entryContexts: entries, resumeId: resume._id, limit: 30,
  });
  evidence = evidence.filter((item) => !item.source?.resumeId || String(item.source.resumeId) === String(resume._id));
  const currentFacts = library.facts(selected);
  evidence = evidence.filter((item) => item.source?.kind !== 'resume' || currentFacts.some((fact) => fact.kind === item.kind && fact.statement === item.source.quote && fact.context?.entryId === item.context?.entryId && fact.context?.section === item.context?.section));
  const snapshots = await require('./claimEvidenceService').refresh(owner, evidence);
  evidence = snapshots.filter((item) => !item.stale && item.verification === 'confirmed');
  const relevant = rankEvidence(evidence, workspace.description);
  const data = { workspaceId: String(workspace._id), company: workspace.company, title: workspace.title, description: workspace.description,
    workspaceRevision: workspace.preparationRevision || 1, resumeId: String(resume._id), resumeTitle: resume.title,
    resumeRevision: resume.contentRevision || 1, resumeVerified: Boolean(resume.verifiedAt), selectedResume: selected,
    evidence: relevant, projects: selected.projects.map((project) => ({ ...project, citations: relevant.filter((item) => item.context?.section === 'projects' && item.context.entryId === project.entryId) })),
    topics: topics(workspace.description, relevant), latestVersionId: workspace.latestVersionId ? String(workspace.latestVersionId) : null };
  return { workspace, data, sourceFingerprint: fingerprint(data) };
}
function rankEvidence(evidence, description) {
  const words = new Set(library.tokens(description));
  return evidence.map((item) => { const matched = library.tokens(item.statement + ' ' + item.title + ' ' + (item.technologies || []).join(' ')).filter((word) => words.has(word));
    return { ...item, relevance: matched.length, reason: matched.length ? 'Job terms in this fact: ' + matched.slice(0, 6).join(', ') : 'Confirmed fact from a selected resume entry' };
  }).sort((a, b) => b.relevance - a.relevance || a.id.localeCompare(b.id));
}
function topics(description, evidence) {
  return extractSkills(description).slice(0, 10).map((skill) => ({ title: skill,
    prompt: 'Explain an example involving ' + skill + ', your contribution, decisions and limitations.',
    supported: evidence.some((item) => require('../providers/resumeFacts').hasSkill(item.statement + ' ' + (item.technologies || []).join(' '), skill)),
  })).concat([{ title: 'Role and company', prompt: 'Why does this role interest you? Prepare questions about the team and expectations.', supported: false }]);
}
function drafts(data) {
  const facts = data.evidence.filter((item) => item.kind !== 'skill').slice(0, 3);
  const examples = facts.length ? facts.map((item) => item.title + ': ' + item.statement).join('\n') : '[Add and confirm relevant career facts in your evidence library before describing your experience.]';
  const signoff = data.selectedResume.contactInfo?.name || '[Your name]';
  return {
    coverLetter: 'Dear hiring team,\n\nI am interested in the ' + data.title + ' opportunity at ' + data.company + '. The following examples from my experience are relevant to discuss:\n\n' + examples + '\n\nI would welcome a conversation about the role and the team’s priorities.\n\nKind regards,\n' + signoff,
    recruiter: 'Hello,\n\nI am interested in the ' + data.title + ' role at ' + data.company + '. Here are examples from my experience:\n\n' + examples + '\n\nCould you share the next steps for this opportunity?\n\n' + signoff,
    referral: 'Hello,\n\nI am exploring the ' + data.title + ' opportunity at ' + data.company + '. These examples may help you assess whether my background is relevant:\n\n' + examples + '\n\nIf you are comfortable, would you consider referring me or sharing advice on the application process?\n\n' + signoff,
    followUp: 'Hello,\n\nI am writing about the ' + data.title + ' opportunity at ' + data.company + '. I remain interested and would appreciate any update on next steps. Please let me know if further information would be helpful.\n\n' + signoff,
  };
}
function checks(item) {
  const baseline = drafts(item.snapshot);
  return Object.fromEntries(kinds.map((kind) => [kind, item.drafts[kind] === baseline[kind] ? [] : require('./claimValidation').issues(item.drafts[kind], Object.values(baseline).join('\n'))]));
}
async function view(id, owner) {
  await require('./workspaceService').get(id, owner);
  const item = await Pack.findOne({ owner, workspaceId: id });
  if (!item) return { pack: null };
  let current;
  try { current = await context(id, owner); }
  catch (error) { if (error.statusCode !== 404 && error.statusCode !== 400 && error.statusCode !== 409) throw error; }
  return { pack: plain(item), stale: !current || current.sourceFingerprint !== item.sourceFingerprint, checks: checks(item),
    limitations: 'Drafts quote confirmed selected-resume facts. Checks detect some unsupported quantities, technologies and responsibilities; review meaning and factual scope yourself. Nothing is sent by this app.' };
}
async function generate(id, owner, input = {}) {
  if (Object.keys(input).some((key) => key !== 'revision')) throw fail('Unsupported preparation pack field');
  const current = await context(id, owner);
  if (current.workspace.archivedAt) throw fail('Restore this workspace before updating its preparation pack.', 409);
  const before = await Pack.findOne({ owner, workspaceId: id });
  if (before && before.revision !== revision(input.revision)) throw fail('Preparation pack changed elsewhere. Reload before regenerating.', 409);
  const data = { sourceFingerprint: current.sourceFingerprint, snapshot: current.data, drafts: drafts(current.data), reviewed: [] };
  if (before) {
    const result = await Pack.findOneAndUpdate({ _id: before._id, owner, revision: input.revision }, { $set: data, $inc: { revision: 1 } }, { new: true });
    if (!result) throw fail('Preparation pack changed elsewhere. Reload before regenerating.', 409);
  } else {
    try { await Pack.create({ owner, workspaceId: id, ...data }); }
    catch (error) { if (error.code === 11000) throw fail('Preparation pack was created elsewhere. Reload it.', 409); throw error; }
  }
  return view(id, owner);
}
async function save(id, owner, input) {
  if (!input || Object.keys(input).some((key) => !['revision', 'kind', 'body', 'reviewed', 'confirmed'].includes(key)) || !kinds.includes(input.kind)) throw fail('Choose a supported draft');
  const state = await view(id, owner), item = state.pack;
  if (!item) throw fail('Create the preparation pack first', 404);
  if (state.stale) throw fail('Job, resume or evidence changed. Regenerate the pack before reviewing drafts.', 409);
  const workspace = await require('./workspaceService').get(id, owner);
  if (workspace.archivedAt) throw fail('Restore the workspace before editing drafts.', 409);
  const body = text(input.body, 'Draft', 16000);
  if (!body) throw fail('A draft cannot be empty');
  if (typeof input.reviewed !== 'boolean') throw fail('Choose whether this draft has been reviewed');
  if (input.reviewed && input.confirmed !== true) throw fail('Confirm that you checked the draft against your actual experience');
  if (input.reviewed && /\[(?:Add and confirm|Your name)/.test(body)) throw fail('Complete or remove the placeholders before marking this draft reviewed');
  const updated = { ...item, drafts: { ...item.drafts, [input.kind]: body } };
  if (input.reviewed && checks(updated)[input.kind].length) throw fail('Resolve the unsupported claims before marking this draft reviewed');
  const reviewed = item.reviewed.filter((kind) => kind !== input.kind);
  if (input.reviewed) reviewed.push(input.kind);
  const result = await Pack.findOneAndUpdate({ _id: item._id, owner, revision: revision(input.revision) }, { $set: { drafts: updated.drafts, reviewed }, $inc: { revision: 1 } }, { new: true });
  if (!result) throw fail('Preparation pack changed elsewhere. Reload before saving.', 409);
  return view(id, owner);
}
async function download(id, owner) {
  const state = await view(id, owner), item = state.pack;
  if (!item) throw fail('Create a preparation pack first', 404);
  if (state.stale) throw fail('Regenerate this preparation pack after the source changes.', 409);
  if (!item.reviewed.includes('coverLetter')) throw fail('Review the cover letter before downloading the preparation pack.', 409);
  const details = await require('./workspaceService').details(id, owner), snap = item.snapshot;
  return [snap.title + ' at ' + snap.company, 'Selected resume: ' + snap.resumeTitle + ' (revision ' + snap.resumeRevision + ')', resumeText(snap.selectedResume),
    ...kinds.filter((kind) => item.reviewed.includes(kind)).map((kind) => labels[kind] + '\n' + item.drafts[kind]),
    'Relevant project examples\n' + snap.projects.map((project) => project.title + ': ' + [project.description, ...(project.highlights || [])].filter(Boolean).join('\n')).join('\n\n'),
    'Interview topics\n' + snap.topics.map((topic) => topic.title + ': ' + topic.prompt + (topic.supported ? ' (confirmed evidence available)' : ' (prepare or clarify)')).join('\n'),
    'Preparation checklist\n' + details.preparation.map((step) => (step.done ? '[x] ' : '[ ] ') + step.label).join('\n'),
    'Evidence citations\n' + snap.evidence.map((fact) => fact.title + ' [' + fact.id + ', revision ' + fact.revision + ']: ' + fact.statement).join('\n'),
  ].join('\n\n');
}
module.exports = { view, generate, save, download, drafts, topics, rankEvidence, checks, kinds, labels };
