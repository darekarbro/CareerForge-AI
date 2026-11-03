const library = require('./evidenceService');
const checks = require('./claimValidation');
const { plain, resumeText } = require('../providers/resumeFacts');
const { withEntryIds } = require('./resumeStructure');
const support = (item) => JSON.stringify([item.statement, item.kind, [...(item.technologies || [])].sort(), item.measurement || 'unknown', item.measurementNotes || '', item.context?.section, item.context?.entryId, item.context?.recordId]);
const citation = (item) => ({ evidenceId: item.id, revision: item.revision, title: item.title, quote: item.statement, verification: item.verification, measurement: item.measurement, measurementNotes: item.measurementNotes, source: item.source, context: item.context });
async function refresh(owner, snapshots = []) {
  const records = await require('../models/CareerEvidence').find({ owner, _id: { $in: snapshots.map((item) => item.id).filter((id) => /^[a-f0-9]{24}$/i.test(id)) } });
  const byId = new Map(records.map((item) => [String(item._id), item]));
  const sourceIds = records.map((item) => item.source?.sourceId).filter(Boolean), pending = sourceIds.length ? await require('../models/EvidenceSource').find({ owner, _id: { $in: sourceIds }, importPending: true }).select('_id') : [];
  const pendingIds = new Set(pending.map((item) => String(item._id)));
  return snapshots.map((item) => { const current = byId.get(item.id); return current && support(current) === support(item) && !current.archivedAt && !pendingIds.has(String(current.source?.sourceId)) ? library.snapshot(current) : { ...item, verification: 'unverified', stale: true }; });
}
function evaluate(source, candidate, records, { withhold = false } = {}) {
  const original = withEntryIds(source), content = withEntryIds(candidate), claims = [];
  const ranked = (statement, eligible) => {
    const words = new Set(library.tokens(statement));
    return eligible.map((item) => ({ item, score: library.tokens(item.statement + ' ' + item.technologies.join(' ')).filter((word) => words.has(word)).length }))
      .sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id)).filter((entry) => entry.score || eligible.length === 1).slice(0, 6).map((entry) => entry.item);
  };
  const add = (path, label, before, after, actual, eligible, technologies = []) => {
    if (!after?.trim()) return after;
    const problems = checks.issues(after, actual, { technologies }), citations = ranked(after, eligible.filter((item) => item.verification !== 'rejected' && !item.stale));
    const changed = after !== before, withheld = withhold && changed && problems.length > 0;
    claims.push({ path, label, text: withheld ? before || '' : after, ...(withheld ? { withheldText: after } : {}), status: withheld ? 'withheld' : problems.length ? 'needs_verification' : !citations.length || citations.some((item) => item.verification !== 'confirmed') ? 'needs_confirmation' : changed ? 'source_consistent' : 'confirmed_fact', issues: problems,
      explanation: withheld ? 'Unsupported wording was replaced with source wording and is excluded from the generated draft.' : changed ? 'Entry-specific checks are consistent with the cited facts. You must still review meaning and scope.' : 'Compare this statement with its cited source facts.',
      citations: citations.map(citation) });
    return withheld ? before || '' : after;
  };
  content.summary = add(['summary'], 'Professional summary', original.summary || '', content.summary || '', resumeText(original) + '\n' + records.filter((item) => item.verification === 'confirmed' && !item.stale).map((item) => item.statement).join('\n'), records);
  for (const section of ['workExperience', 'projects']) content[section] = content[section].map((entry, index) => {
    const before = original[section].find((item) => item.entryId === entry.entryId) || original[section][index] || {}, eligible = records.filter((item) => item.context?.entryId === entry.entryId && item.context?.section === section);
    const confirmed = eligible.filter((item) => item.verification === 'confirmed' && !item.stale), actual = checks.entryText(before) + '\n' + confirmed.map((item) => item.statement).join('\n');
    const technologies = [...(before.technologies || []), ...confirmed.flatMap((item) => item.technologies || [])], label = entry.title || [entry.role, entry.company].filter(Boolean).join(' at ');
    if (section === 'projects') entry.description = add([section, index, 'description'], label + ' / description', before.description || '', entry.description || '', actual, eligible, technologies);
    entry.highlights = (entry.highlights || []).map((line, number) => add([section, index, 'highlights', number], label + ' / achievement ' + (number + 1), before.highlights?.[number] || '', line, actual, eligible, technologies)).filter(Boolean);
    return entry;
  });
  return { content, claims, summary: { total: claims.length, cited: claims.filter((item) => item.citations.length).length, withheld: claims.filter((item) => item.status === 'withheld').length, needsReview: claims.filter((item) => ['needs_verification', 'needs_confirmation'].includes(item.status)).length }, limitations: 'Structured checks catch unsupported quantities, known technologies and selected responsibility claims. They do not establish semantic truth, authorship or external verification.' };
}
async function prepare(owner, resume, source, candidate, snapshots, sourceRevision) {
  const records = snapshots || (await library.syncResume(owner, resume, withEntryIds(source), sourceRevision)).map(library.snapshot);
  const current = await refresh(owner, records);
  return { ...evaluate(source, candidate, current, { withhold: true }), evidenceSnapshot: current };
}
async function version(owner, item) {
  const snapshots = item.evidenceSnapshot || [], current = await refresh(owner, snapshots);
  const report = evaluate(plain(item.sourceContent || {}), plain(item.reviewedContent || item.tailoredContent), current);
  const byId = new Map(current.map((record) => [record.id, record]));
  const withheld = (item.claimEvidence || []).filter((claim) => claim.status === 'withheld').map((claim) => ({ ...claim, citations: (claim.citations || []).map((old) => byId.get(old.evidenceId)).filter((record) => record && record.verification !== 'rejected' && !record.stale).map(citation) }));
  return { ...report, claims: [...report.claims, ...withheld], historical: withheld.length, legacy: !snapshots.length };
}
module.exports = { refresh, evaluate, prepare, version };
