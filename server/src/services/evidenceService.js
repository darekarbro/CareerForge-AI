const crypto = require('node:crypto');
const Evidence = require('../models/CareerEvidence');
const { text, revision, fail } = require('./resumeContent');
const { plain, extractSkills } = require('../providers/resumeFacts');
const structure = require('./resumeStructure');
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const snapshot = (item) => ({ id: String(item._id), revision: item.revision, kind: item.kind, title: item.title, statement: item.statement, technologies: [...(item.technologies || [])], context: plain(item.context), source: plain(item.source), verification: item.verification, measurement: item.measurement, measurementNotes: item.measurementNotes });
async function get(id, owner) { const item = await Evidence.findOne({ _id: id, owner, archivedAt: null }); if (!item) throw fail('Evidence not found', 404); return item; }
async function context(owner, value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some((key) => !['section', 'entryId', 'recordId'].includes(key))) throw fail('Choose a supported evidence context');
  if (!value.entryId && !value.section && !value.recordId) return {};
  if (value.recordId && !/^[a-f0-9]{24}$/i.test(value.recordId)) throw fail('Choose a valid source record');
  if (!['workExperience', 'projects'].includes(value.section) || !/^[a-zA-Z0-9_-]{1,100}$/.test(value.entryId || '')) throw fail('Choose an experience or project entry');
  const resumes = await require('../models/Resume').find({ owner, deleting: { $ne: true } }).select('parsedData');
  const profile = await require('../models/CareerProfile').findOne({ owner }).select('content');
  const matches = [...resumes.map((item) => ({ id: String(item._id), content: item.parsedData })), ...(profile ? [{ id: String(profile._id), content: profile.content }] : [])].filter((item) => (!value.recordId || value.recordId === item.id) && structure.withEntryIds(item.content)[value.section].some((entry) => entry.entryId === value.entryId));
  if (!matches.length) throw fail('Evidence context not found', 404);
  if (matches.length > 1) throw fail('Choose the specific resume or profile for this evidence entry', 409);
  return { section: value.section, entryId: value.entryId, recordId: matches[0].id };
}
function input(value) {
  if (!value || Object.keys(value).some((key) => !['revision', 'kind', 'title', 'statement', 'technologies', 'context', 'verification', 'measurement', 'measurementNotes'].includes(key))) throw fail('Unsupported evidence field');
  const title = text(value.title, 'Evidence title', 200), statement = text(value.statement, 'Evidence statement', 4000);
  if (!title || !statement || !['achievement', 'project', 'responsibility', 'skill'].includes(value.kind)) throw fail('Add a title, statement and supported evidence type');
  if (!['unverified', 'confirmed', 'rejected'].includes(value.verification) || !['unknown', 'reported', 'measured'].includes(value.measurement)) throw fail('Choose verification and measurement states');
  if (!Array.isArray(value.technologies) || value.technologies.length > 60) throw fail('Use at most 60 technologies');
  const technologies = [...new Set(value.technologies.map((item) => text(item, 'Technology', 120)).filter(Boolean))], measurementNotes = text(value.measurementNotes, 'Measurement notes', 1500);
  if (value.measurement === 'measured' && !measurementNotes) throw fail('Describe how this outcome was measured');
  return { kind: value.kind, title, statement, technologies, verification: value.verification, measurement: value.measurement, measurementNotes, confirmedAt: value.verification === 'confirmed' ? new Date() : null };
}
async function save(owner, value, id) {
  const data = { ...input(value), context: await context(owner, value.context) };
  if (!id) { if (await Evidence.countDocuments({ owner, archivedAt: null }) >= 4000) throw fail('Archive existing evidence before adding more', 409); return Evidence.create({ owner, key: 'manual:' + crypto.randomUUID(), ...data, source: { kind: 'manual', quote: data.statement, label: 'User-entered career fact' } }); }
  const before = await get(id, owner);
  const result = await Evidence.findOneAndUpdate({ _id: id, owner, revision: revision(value.revision), archivedAt: null }, { $set: { ...data, source: { ...plain(before.source), quote: before.source?.quote || data.statement, ...(data.statement !== before.statement ? { label: 'User-edited fact; original source available separately' } : {}) } }, $inc: { revision: 1 } }, { new: true, runValidators: true });
  if (!result) throw fail('Evidence changed elsewhere. Reload before saving.', 409);
  return result;
}
async function archive(id, owner, value) {
  const item = await Evidence.findOneAndUpdate({ _id: id, owner, revision: revision(value.revision), archivedAt: null }, { $set: { archivedAt: new Date(), verification: 'rejected' }, $inc: { revision: 1 } }, { new: true });
  if (!item) { await get(id, owner); throw fail('Evidence changed elsewhere. Reload before archiving.', 409); } return item;
}
function facts(content) {
  const items = [], add = (kind, title, statement, path, context = {}) => { if (statement?.trim()) items.push({ kind, title, statement: statement.trim(), path, context }); };
  const skills = new Set();
  for (const group of ['technical', 'frameworks', 'tools', 'soft', 'all']) (content.skills?.[group] || []).forEach((skill, index) => {
    const key = require('../providers/resumeFacts').normalizeSkill(skill);
    if (!skills.has(key)) { skills.add(key); add('skill', skill, skill, ['skills', group, index]); }
  });
  for (const section of ['workExperience', 'projects']) (content[section] || []).forEach((entry, index) => {
    const title = entry.title || [entry.role, entry.company].filter(Boolean).join(' at '), scope = { section, entryId: entry.entryId };
    if (section === 'projects') add('project', title, entry.description, [section, index, 'description'], scope);
    (entry.highlights || []).forEach((line, number) => add('achievement', title, line, [section, index, 'highlights', number], scope));
    (entry.technologies || []).forEach((skill, number) => add('skill', title + ' / ' + skill, skill, [section, index, 'technologies', number], scope));
  });
  return items.slice(0, 500);
}
async function syncResume(owner, resume, content = structure.withEntryIds(resume.parsedData), sourceRevision = resume.contentRevision || 1, kind = 'resume') {
  const records = [...new Map(facts(content).map((raw) => {
    const fact = { ...raw, context: raw.context.entryId ? { ...raw.context, recordId: String(resume._id) } : raw.context };
    const key = kind + ':' + resume._id + ':' + hash(JSON.stringify([fact.context, fact.kind, fact.statement]));
    return [key, { owner, key, kind: fact.kind, title: fact.title, statement: fact.statement, technologies: extractSkills(fact.statement), context: fact.context,
      source: { kind, [kind === 'profile' ? 'profileId' : 'resumeId']: resume._id, revision: sourceRevision, path: fact.path, quote: fact.statement, label: resume.title },
      verification: resume.verifiedAt ? 'confirmed' : 'unverified', ...(resume.verifiedAt ? { confirmedAt: resume.verifiedAt } : {}), measurement: /\d/.test(fact.statement) ? 'reported' : 'unknown' }];
  })).values()];
  const keys = records.map((item) => item.key), existing = await Evidence.countDocuments({ owner, key: { $in: keys } });
  if (await Evidence.countDocuments({ owner, archivedAt: null }) + records.length - existing > 4000) throw fail('Evidence library capacity reached. Archive or consolidate facts before importing more.', 409);
  // Idempotent collection never changes a user's verification decision or edited statement.
  if (records.length) try { await Evidence.bulkWrite(records.map((record) => ({ updateOne: { filter: { owner, key: record.key }, update: { $setOnInsert: record }, upsert: true } })), { ordered: false }); }
  catch (error) { if (error.code !== 11000) throw error; }
  return Evidence.find({ owner, key: { $in: keys }, archivedAt: null });
}
async function verify(id, owner, value) {
  if (Object.keys(value).some((key) => !['revision', 'verification'].includes(key)) || !['unverified', 'confirmed', 'rejected'].includes(value.verification)) throw fail('Choose a supported verification state');
  const item = await Evidence.findOneAndUpdate({ _id: id, owner, revision: revision(value.revision), archivedAt: null }, { $set: { verification: value.verification, confirmedAt: value.verification === 'confirmed' ? new Date() : null }, $inc: { revision: 1 } }, { new: true });
  if (!item) { await get(id, owner); throw fail('Evidence changed elsewhere. Reload it.', 409); } return item;
}
const tokens = (value) => [...new Set(String(value || '').normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}+#.]+/gu) || [])].filter((word) => word.length > 2).slice(0, 80);
async function retrieve(owner, query = '', { entryIds, entryContexts, resumeId, limit = 24 } = {}) {
  const words = tokens(text(query, 'Retrieval query', 1500)), filter = { owner, archivedAt: null, verification: 'confirmed' };
  if (entryIds) filter.$or = [{ ...(entryContexts?.length ? { $or: entryContexts.map((entry) => ({ 'context.section': entry.section, 'context.entryId': entry.entryId })) } : { 'context.entryId': { $in: entryIds } }), ...(resumeId ? { 'context.recordId': String(resumeId) } : {}) }, { kind: 'skill', 'context.entryId': { $exists: false }, ...(resumeId ? { 'source.resumeId': resumeId } : {}) }];
  const records = await Evidence.find(filter).sort({ updatedAt: -1 }).limit(4000);
  return records.map((item) => {
    const terms = new Set(tokens(item.title + ' ' + item.statement + ' ' + item.technologies.join(' '))), matched = words.filter((word) => terms.has(word));
    return { ...snapshot(item), relevance: matched.length, reason: matched.length ? 'Matches: ' + matched.slice(0, 8).join(', ') : 'Confirmed evidence in the selected scope' };
  }).sort((a, b) => b.relevance - a.relevance || a.id.localeCompare(b.id)).slice(0, Math.max(1, Math.min(30, limit)));
}
async function list(owner, options = {}) {
  const filter = { owner, archivedAt: null };
  if (options.state && options.state !== 'all') { if (!['confirmed', 'unverified', 'rejected'].includes(options.state)) throw fail('Choose a supported verification filter'); filter.verification = options.state; }
  if (options.search) { const term = text(options.search, 'Search', 160).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); filter.$or = [{ title: new RegExp(term, 'i') }, { statement: new RegExp(term, 'i') }]; }
  const page = Number(options.page || 1); if (!Number.isInteger(page) || page < 1 || page > 80) throw fail('Choose a valid evidence page');
  const [items, total] = await Promise.all([Evidence.find(filter).sort({ updatedAt: -1, _id: 1 }).skip((page - 1) * 50).limit(50), Evidence.countDocuments(filter)]);
  return { items, total, page, pageSize: 50 };
}
module.exports = { get, input, context, save, archive, verify, facts, syncResume, retrieve, list, snapshot, hash, tokens };
