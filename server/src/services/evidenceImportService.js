const axios = require('axios');
const Source = require('../models/EvidenceSource');
const Evidence = require('../models/CareerEvidence');
const library = require('./evidenceService');
const { text, fail, revision } = require('./resumeContent');
function repository(value) {
  let url; try { url = new URL(value); } catch { throw fail('Use a public https://github.com/owner/repository URL'); }
  const parts = url.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
  if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.port || url.username || url.password || url.search || url.hash || parts.length !== 2 || !/^[a-zA-Z0-9-]{1,39}$/.test(parts[0]) || !/^[a-zA-Z0-9_.-]{1,100}$/.test(parts[1])) throw fail('Use a public https://github.com/owner/repository URL');
  const [owner, raw] = parts, repo = raw.replace(/\.git$/, ''); if (!repo || ['.', '..'].includes(repo)) throw fail('Choose a valid repository');
  return { owner, repo, url: 'https://github.com/' + owner + '/' + repo };
}
const suspicious = (line) => /ignore\s+(?:all\s+)?(?:previous|prior)\s+(?:instructions|prompts)|(?:^|\n)\s*(?:system|developer)\s*:|(?:reveal|exfiltrate|print).{0,60}(?:secret|api.?key|system\s+prompt)|<script|javascript:/i.test(line);
function candidates(sourceText, title, technologies = []) {
  const lines = sourceText.split(/\r?\n/).map((line, index) => ({ line: line.trim(), number: index + 1 })).filter(({ line }) => line.length >= 12 && line.length <= 1800 && !/^\s*(?:```|<|!\[|\[!|https?:\/\/)/.test(line));
  return lines.slice(0, 40).map(({ line, number }) => ({ id: library.hash(number + ':' + line).slice(0, 24), title: title.slice(0, 180), kind: 'project', statement: line.replace(/^[-*#>\s]+/, ''), technologies, quote: line, line: number, warning: suspicious(line) ? 'This passage resembles instructions. Do not import instructions as career facts.' : 'A document describes a project, not necessarily your personal contribution. Confirm your own work.' }));
}
async function create(owner, { kind, title, url, sourceText, metadata, technologies }) {
  if (!sourceText?.trim()) throw fail('No readable source text was found');
  if (sourceText.length > 48000) throw fail('Source exceeds 48,000 characters. Import a smaller project document or relevant excerpt.', 413);
  if (await Source.countDocuments({ owner, confirmedAt: null, expiresAt: { $gt: new Date() } }) >= 20) throw fail('Discard an existing preview before creating another.', 409);
  return Source.create({ owner, kind, title, url, text: sourceText, metadata, candidates: candidates(sourceText, title, technologies) });
}
async function github(owner, input) {
  if (Object.keys(input).some((key) => !['url', 'confirmOwnership'].includes(key)) || input.confirmOwnership !== true) throw fail('Confirm that this is your repository and that you will verify your own contribution');
  const repo = repository(text(input.url, 'GitHub repository URL', 500));
  const options = { timeout: 10000, maxRedirects: 0, maxContentLength: 320000, headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'CareerForge-Evidence-Import' } };
  try {
    const metadata = (await axios.get('https://api.github.com/repos/' + repo.owner + '/' + repo.repo, options)).data;
    if (metadata.private || metadata.owner?.login?.toLowerCase() !== repo.owner.toLowerCase() || metadata.name?.toLowerCase() !== repo.repo.toLowerCase()) throw fail('Repository identity did not match the requested public repository');
    const [readme, languages] = await Promise.allSettled([axios.get('https://api.github.com/repos/' + repo.owner + '/' + repo.repo + '/readme', options), axios.get('https://api.github.com/repos/' + repo.owner + '/' + repo.repo + '/languages', options)]);
    if (readme.status === 'rejected' && readme.reason.response?.status !== 404) throw readme.reason;
    if (languages.status === 'rejected') throw languages.reason;
    const body = readme.status === 'fulfilled' ? readme.value.data : null;
    if (body && (body.encoding !== 'base64' || typeof body.content !== 'string' || body.size > 192000)) throw fail('The README is too large or uses an unsupported representation', 413);
    const sourceText = [metadata.description || '', body ? Buffer.from(body.content, 'base64').toString('utf8') : ''].filter(Boolean).join('\n\n');
    return create(owner, { kind: 'github', title: repo.owner + '/' + repo.repo, url: repo.url, sourceText, technologies: Object.keys(languages.value.data || {}).slice(0, 30), metadata: { repository: repo.owner + '/' + repo.repo, readmeSha: body?.sha, fetchedAt: new Date(), ownership: 'user-attested', note: 'Public repository information is not proof of authorship or personal contribution.' } });
  } catch (error) {
    if (error.statusCode) throw error;
    if ([403, 429].includes(error.response?.status)) throw fail('GitHub rate limit or access restriction. Try later or upload a project document.', 429);
    if (error.response?.status === 404) throw fail('Public repository not found. Check the URL or upload a document from your private project.', 404);
    throw fail('GitHub could not be read safely. Retry or upload a project document.', 502);
  }
}
async function document(owner, file) {
  if (!file?.buffer) throw fail('Choose a PDF, DOCX or TXT project document');
  const type = require('node:path').extname(file.originalname).slice(1).toLowerCase();
  if (!['pdf', 'docx', 'txt'].includes(type)) throw fail('Choose a PDF, DOCX or TXT project document');
  let sourceText;
  try { sourceText = await require('../agents/parserAgent').extractTextFromBuffer(file.buffer, type); }
  catch { throw fail('This project document could not be read. Use an unencrypted PDF, DOCX or UTF-8 TXT file.', 400); }
  return create(owner, { kind: 'document', title: file.originalname.slice(0, 180), sourceText, metadata: { fileType: type, originalRetained: false, note: 'Only extracted text is retained; the uploaded file is not stored or sent to AI during preview.' }, technologies: [] });
}
async function get(id, owner) { const item = await Source.findOne({ _id: id, owner, $or: [{ confirmedAt: { $ne: null } }, { expiresAt: { $gt: new Date() } }] }); if (!item) throw fail('Import preview not found or expired', 404); return item; }
async function confirm(id, owner, input) {
  const source = await get(id, owner);
  if (Object.keys(input).some((key) => !['revision', 'items', 'confirmFacts', 'context'].includes(key)) || input.confirmFacts !== true || !Array.isArray(input.items) || !input.items.length || input.items.length > 40) throw fail('Select facts and confirm your personal contribution');
  if (source.confirmedAt || source.revision !== revision(input.revision)) throw fail('This preview was already imported or changed. Reload it.', 409);
  const scope = await library.context(owner, input.context), ids = new Set();
  const items = input.items.map((item) => {
    if (!item || Object.keys(item).some((key) => !['candidateId', 'title', 'statement', 'kind', 'technologies', 'measurement', 'measurementNotes'].includes(key)) || ids.has(item.candidateId)) throw fail('Choose each source passage once');
    ids.add(item.candidateId); const candidate = source.candidates.find((entry) => entry.id === item.candidateId);
    if (!candidate || suspicious(candidate.quote) || suspicious(item.statement || '')) throw fail('Select ordinary project facts rather than instruction-like passages');
    const data = library.input({ ...Object.fromEntries(Object.entries(item).filter(([key]) => key !== 'candidateId')), context: scope, verification: 'confirmed' });
    return { owner, key: 'import:' + source._id + ':' + candidate.id, ...data, context: scope, source: { kind: source.kind, sourceId: source._id, quote: candidate.quote, url: source.url, label: source.title, path: ['line', candidate.line] } };
  });
  if (await Evidence.countDocuments({ owner, archivedAt: null }) + items.length > 4000) throw fail('Evidence library capacity reached', 409);
  const claimed = await Source.findOneAndUpdate({ _id: id, owner, revision: input.revision, confirmedAt: null }, { $set: { confirmedAt: new Date() }, $unset: { expiresAt: 1 }, $inc: { revision: 1 } }, { new: true });
  if (!claimed) throw fail('This preview was already imported. Reload it.', 409);
  try { await Evidence.bulkWrite(items.map((item) => ({ updateOne: { filter: { owner, key: item.key }, update: { $setOnInsert: item }, upsert: true } }))); }
  catch (error) { await Source.updateOne({ _id: id, owner }, { $unset: { confirmedAt: 1 }, $set: { expiresAt: new Date(Date.now() + 86400000) } }); throw error; }
  return { source: claimed, items: await Evidence.find({ owner, key: { $in: items.map((item) => item.key) } }) };
}
async function discard(id, owner) { const source = await get(id, owner); if (source.confirmedAt) throw fail('This source supports saved evidence. Archive its facts in the library; full account deletion removes source records.', 409); await Source.deleteOne({ _id: id, owner, confirmedAt: null }); return { discarded: true }; }
module.exports = { repository, candidates, github, document, get, confirm, discard };
