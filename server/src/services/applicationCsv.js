const Application = require('../models/Application');
const service = require('./applicationService');
const { fail } = require('./resumeContent');
const columns = ['company', 'roleTitle', 'sourcePlatform', 'jobLink', 'status', 'salaryRange', 'location', 'notes', 'appliedDate', 'deadline', 'followUpAt', 'interviewAt', 'recruiterName', 'recruiterEmail', 'recruiterPhone', 'recruiterNotes', 'inAppReminders', 'calendarAlerts', 'leadMinutes'];
function parse(csv) {
  if (typeof csv !== 'string' || !csv.trim() || Buffer.byteLength(csv) > 1024 * 1024) throw fail('Choose a nonempty CSV smaller than 1 MB.');
  const rows = []; let row = [], field = '', quoted = false, endedQuote = false;
  const finish = () => { row.push(field); if (row.some((value) => value.trim())) rows.push(row); row = []; field = ''; endedQuote = false; if (rows.length > 201) throw fail('Import at most 200 application rows at a time.'); };
  csv = csv.replace(/^\uFEFF/, '');
  for (let index = 0; index < csv.length; index++) {
    const char = csv[index];
    if (quoted) { if (char === '"') { if (csv[index + 1] === '"') { field += '"'; index++; } else { quoted = false; endedQuote = true; } } else field += char; continue; }
    if (char === ',' || char === '\n' || char === '\r') {
      if (char === ',') { row.push(field); field = ''; endedQuote = false; }
      else { finish(); if (char === '\r' && csv[index + 1] === '\n') index++; }
    } else if (char === '"' && !field && !endedQuote) quoted = true;
    else { if (endedQuote || char === '"') throw fail('Malformed CSV quoting. Use double quotes around fields containing commas or newlines.'); field += char; }
  }
  if (quoted) throw fail('CSV contains an unclosed quote.');
  if (field || row.length || endedQuote) finish();
  const header = rows.shift()?.map((value) => value.trim());
  if (!header || !header.includes('company') || !header.includes('roleTitle')) throw fail('CSV requires company and roleTitle column headings. Export applications to get a template.');
  if (header.some((key) => !columns.includes(key)) || new Set(header).size !== header.length) throw fail('CSV contains unsupported or repeated column headings. Export applications to get a template.');
  return rows.map((values, index) => ({ row: index + 2, values: Object.fromEntries(header.map((key, offset) => [key, values[offset] || ''])), error: values.length === header.length ? null : 'Column count does not match headings.' }));
}
const norm = (value) => String(value || '').normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
function urlKey(value) {
  if (!value) return '';
  try { const url = new URL(value); url.hash = ''; for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$)/i.test(key)) url.searchParams.delete(key); url.searchParams.sort(); return url.href.replace(/\/$/, ''); } catch { return value; }
}
function duplicate(a, b) { return (a.jobLink && b.jobLink && urlKey(a.jobLink) === urlKey(b.jobLink)) || (norm(a.company) === norm(b.company) && norm(a.roleTitle) === norm(b.roleTitle)); }
function bodyFor(values) {
  const body = Object.fromEntries(Object.entries(values).filter(([key]) => !/^(recruiter|inAppReminders|calendarAlerts|leadMinutes)/.test(key)));
  body.company = body.company?.trim(); body.roleTitle = body.roleTitle?.trim();
  if (!body.company || !body.roleTitle) throw fail('Company and role title are required.');
  body.sourcePlatform ||= 'Other'; body.status ||= 'saved';
  if (!['LinkedIn', 'Internshala', 'Naukri', 'Indeed', 'Company Portal', 'Referral', 'Other'].includes(body.sourcePlatform)) throw fail('Unsupported source platform.');
  if (!['saved', 'applied', 'oa', 'interview', 'offer', 'rejected'].includes(body.status)) throw fail('Unsupported application status.');
  body.recruiter = Object.fromEntries(['Name', 'Email', 'Phone', 'Notes'].map((key) => [key.toLowerCase(), values['recruiter' + key] || '']));
  const boolean = (value, fallback) => { if (!value) return fallback; if (!['true', 'false'].includes(value.toLowerCase())) throw fail('Reminder values must be true or false.'); return value.toLowerCase() === 'true'; };
  body.notificationPreferences = { inApp: boolean(values.inAppReminders, true), calendarAlarm: boolean(values.calendarAlerts, false), leadMinutes: values.leadMinutes ? Number(values.leadMinutes) : 60 };
  return body;
}
async function preview(owner, input) {
  if (!input || Object.keys(input).some((key) => key !== 'csv')) throw fail('Provide CSV text to preview.');
  const rows = parse(input.csv), existing = await Application.find({ owner }).select('company roleTitle jobLink').lean(), seen = [];
  for (const item of rows) {
    if (item.error) continue;
    try {
      item.application = bodyFor(item.values);
      // Reuse application validation for length, date, URL, contact and reminder rules.
      const validated = await service.validateLinks(owner, item.application);
      if (validated.jobLink !== undefined) item.application.jobLink = validated.jobLink;
      if (item.application.appliedDate) service.parseDate(item.application.appliedDate);
      await new Application({ owner, ...item.application }).validate();
      const saved = existing.find((app) => duplicate(app, item.application));
      const earlier = seen.find((entry) => duplicate(entry.application, item.application));
      if (saved) item.duplicate = { applicationId: String(saved._id), label: saved.roleTitle + ' at ' + saved.company };
      else if (earlier) item.duplicate = { row: earlier.row, label: 'CSV row ' + earlier.row };
      seen.push(item);
    } catch (error) { item.error = error.message; delete item.application; }
  }
  return { rows, total: rows.length, importable: rows.filter((item) => !item.error && !item.duplicate).length };
}
async function importRows(owner, input) {
  if (!input || Object.keys(input).some((key) => !['csv', 'rows'].includes(key)) || !Array.isArray(input.rows) || !input.rows.length || input.rows.length > 200 || input.rows.some((value) => !Number.isInteger(value)) || new Set(input.rows).size !== input.rows.length) throw fail('Choose the preview rows to import.');
  const result = await preview(owner, { csv: input.csv });
  const selected = input.rows.map((number) => result.rows.find((item) => item.row === number));
  if (selected.some((item) => !item || item.error || item.duplicate)) throw fail('Selected rows contain errors or duplicates. Preview again before importing.', 409);
  const imported = [], failed = [];
  for (const item of selected) {
    // A second check protects ordinary retries from adding already-saved rows.
    const current = await Application.find({ owner }).select('company roleTitle jobLink').lean();
    if (current.some((app) => duplicate(app, item.application))) { failed.push({ row: item.row, error: 'Already saved; skipped.' }); continue; }
    try { imported.push({ row: item.row, applicationId: String((await service.createApplication(owner, item.application))._id) }); }
    catch (error) { failed.push({ row: item.row, error: error.message }); }
  }
  return { imported, failed };
}
function cell(value) {
  let text = value instanceof Date ? value.toISOString() : String(value ?? '');
  if (/^[\s]*[=+\-@\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
async function exportCsv(owner) {
  const apps = await Application.find({ owner }).sort({ createdAt: 1 }).lean();
  return '\uFEFF' + [columns.map(cell).join(','), ...apps.map((app) => columns.map((key) => {
    if (key.startsWith('recruiter')) return cell(app.recruiter?.[key.slice(9).toLowerCase()]);
    if (key === 'inAppReminders') return cell(app.notificationPreferences?.inApp !== false);
    if (key === 'calendarAlerts') return cell(app.notificationPreferences?.calendarAlarm === true);
    if (key === 'leadMinutes') return cell(app.notificationPreferences?.leadMinutes ?? 60);
    return cell(app[key]);
  }).join(','))].join('\r\n') + '\r\n';
}
module.exports = { parse, duplicate, preview, importRows, exportCsv, cell };
