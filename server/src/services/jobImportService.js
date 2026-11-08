const axios = require('axios');
const { fail, text } = require('./resumeContent');

// Only construct requests to these documented public GET APIs. Never fetch a
// user-supplied host, follow a redirect or submit an application on their behalf.
function source(value) {
  let parsed;
  try { parsed = new URL(text(value, 'Job URL', 2048)); } catch { throw fail('Enter a full HTTPS Greenhouse or Lever job URL. You can also paste the job manually.'); }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port) throw fail('Use a public HTTPS job URL without credentials or a custom port.');
  let match;
  if (['boards.greenhouse.io', 'job-boards.greenhouse.io'].includes(parsed.hostname) && (match = /^\/([a-zA-Z0-9_-]{1,100})\/jobs\/(\d{1,30})\/?$/.exec(parsed.pathname))) {
    const [, board, id] = match;
    return { provider: 'Greenhouse', board, id, key: `greenhouse:${board.toLowerCase()}:${id}`, jobUrl: `https://boards.greenhouse.io/${board}/jobs/${id}`, apiUrl: `https://boards-api.greenhouse.io/v1/boards/${board}/jobs/${id}`, documentation: 'https://docs.greenhouse.io/job-board.html' };
  }
  if (['jobs.lever.co', 'jobs.eu.lever.co'].includes(parsed.hostname) && (match = /^\/([a-zA-Z0-9_-]{1,100})\/([a-fA-F0-9-]{36})\/?$/.exec(parsed.pathname))) {
    const [, board, id] = match, eu = parsed.hostname === 'jobs.eu.lever.co';
    return { provider: 'Lever', board, id, key: `lever${eu ? '-eu' : ''}:${board.toLowerCase()}:${id.toLowerCase()}`, jobUrl: `https://${parsed.hostname}/${board}/${id}`, apiUrl: `https://${eu ? 'api.eu.lever.co' : 'api.lever.co'}/v0/postings/${board}/${id}?mode=json`, documentation: 'https://github.com/lever/postings-api' };
  }
  throw fail('Automatic import supports public Greenhouse and Lever job URLs. For other sources, copy the role and description into the manual form.');
}

function decode(value) {
  const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', bull: '•', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”' };
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (whole, key) => {
    if (key[0] !== '#') return entities[key.toLowerCase()] ?? whole;
    const number = key[1].toLowerCase() === 'x' ? parseInt(key.slice(2), 16) : Number(key.slice(1));
    return number > 0 && number <= 0x10ffff && !(number >= 0xd800 && number <= 0xdfff) ? String.fromCodePoint(number) : '';
  });
}
function plain(value) {
  if (typeof value !== 'string') return '';
  // Greenhouse may return entity-escaped HTML. Decode twice, then strip it.
  return decode(decode(value)).replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<\/?(?:p|div|li|ul|ol|h[1-6]|br|section)\b[^>]*>/gi, '\n').replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/[ \t]+/g, ' ').replace(/\n\s*\n/g, '\n\n').trim();
}
function fields(job, origin) {
  if (!job || typeof job !== 'object' || Array.isArray(job)) throw fail('This source did not return a published job. Paste the description manually.', 422);
  const title = plain(origin.provider === 'Lever' ? job.text : job.title);
  const company = plain(job.company_name || origin.board);
  const description = origin.provider === 'Greenhouse' ? plain(job.content) : [plain(job.descriptionPlain || job.description),
    ...(Array.isArray(job.lists) ? job.lists.map((list) => [plain(list.text), plain(list.content)].filter(Boolean).join('\n')) : []), plain(job.additionalPlain || job.additional)].filter(Boolean).join('\n\n');
  if (!title || !description) throw fail('This posting has no usable title or description. Paste the job manually.', 422);
  const warnings = ['Review and edit the imported details before saving.'];
  if (!job.company_name) warnings.push('Company name was inferred from the board URL; confirm its spelling.');
  if (title.length > 150 || company.length > 150 || description.length > 24000) warnings.push('Some source text was shortened to fit the workspace. Check the original posting.');
  return { fields: { title: title.slice(0, 150), company: company.slice(0, 150), description: description.slice(0, 24000), jobUrl: origin.jobUrl }, warnings };
}
function matchingWorkspace(items, origin, imported) {
  const norm = (value) => String(value || '').normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
  return items.find((item) => {
    // Distinct posting IDs remain separate opportunities even when an employer
    // uses the same role title for several openings. Manual entries without a
    // URL need the same description too before they count as a duplicate.
    try { return source(item.jobUrl).key === origin.key; } catch { /* Saved manual source. */ }
    return !item.jobUrl && norm(item.company) === norm(imported.company) && norm(item.title) === norm(imported.title)
      && Boolean(item.description) && norm(item.description) === norm(imported.description);
  });
}
async function preview(owner, input, dependencies = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some((key) => key !== 'url')) throw fail('Provide a job URL to preview.');
  const origin = source(input.url);
  let response;
  try {
    response = await (dependencies.get || axios.get)(origin.apiUrl, { timeout: 8000, maxRedirects: 0, maxContentLength: 1024 * 1024, maxBodyLength: 1024 * 1024, responseType: 'json', headers: { Accept: 'application/json' } });
    if (response.status < 200 || response.status >= 300) throw new Error('Source unavailable');
  } catch { throw fail('The public job API is unavailable or this posting is no longer published. Paste the job details manually.', 422); }
  const result = fields(response.data, origin);
  const items = dependencies.findExisting ? await dependencies.findExisting(owner) : await require('../models/JobWorkspace').find({ owner }).select('company title description jobUrl archivedAt').lean();
  const duplicate = matchingWorkspace(items, origin, result.fields);
  return { ...result, source: { provider: origin.provider, url: origin.jobUrl, documentation: origin.documentation, fetchedAt: new Date().toISOString() }, duplicate: duplicate ? { workspaceId: String(duplicate._id), archived: Boolean(duplicate.archivedAt) } : null };
}
module.exports = { source, plain, fields, matchingWorkspace, preview };
