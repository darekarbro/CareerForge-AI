const assert = require('node:assert/strict');
const fs = require('node:fs/promises');

// Runs against the same isolated HTTP server/database as browser-workflows.cjs.
// Only the external public-job response is substituted; browser requests,
// validation, duplicate lookup, persistence and subsequent actions remain real.
module.exports = async ({ page, saved, screenshot, pass, audit, resumeId, workspaceUrl }) => {
  const origin = 'http://localhost:3030', importedCompany = 'Phase Five Import Co';
  const importedRole = 'Python Engineer', importedTitle = importedRole + ' at ' + importedCompany;
  const posting = 'https://boards.greenhouse.io/phase5-fixture/jobs/50501';
  const axios = require('../../server/node_modules/axios'), originalGet = axios.get;
  axios.get = async function (url, ...options) {
    if (url === 'https://boards-api.greenhouse.io/v1/boards/phase5-fixture/jobs/50501') return {
      status: 200, data: { title: importedRole, company_name: importedCompany, content: '<p>Python required. SQL preferred.</p><p>Remote in Pune.</p>' },
    };
    return originalGet.call(this, url, ...options);
  };
  let importedWorkspaceUrl;
  try {
    await page.goto(origin + '/workspaces');
    await page.getByLabel('Job posting URL', { exact: true }).fill(posting);
    await page.getByRole('button', { name: 'Preview import', exact: true }).click();
    const preview = page.getByRole('region', { name: 'Job import preview', exact: true });
    await preview.getByRole('heading', { name: importedTitle, exact: true }).waitFor();
    assert((await preview.innerText()).includes('Python required. SQL preferred.'));
    await require('./buttonContrast.cjs')(page, page.getByRole('button', { name: 'Preview import', exact: true }));
    await audit('phase5-job-import-preview');
    await page.getByRole('button', { name: 'Use preview in editable job form', exact: true }).click();
    assert.equal(await page.getByLabel('Company', { exact: true }).inputValue(), importedCompany);
    await page.getByLabel('Job description', { exact: true }).fill('Python required. SQL preferred.\nRemote in Pune.\nDiscuss input validation decisions with the team.');
    await page.getByRole('combobox', { name: 'Resume', exact: true }).selectOption(resumeId);
    await page.getByRole('button', { name: 'Create job workspace', exact: true }).click();
    await page.waitForURL(/\/workspaces\/[^/]+$/); importedWorkspaceUrl = page.url();
    assert.equal(await page.getByLabel('Company', { exact: true }).inputValue(), importedCompany);
    await page.reload(); await page.getByLabel('Job description', { exact: true }).waitFor();
    assert((await page.getByLabel('Job description', { exact: true }).inputValue()).includes('Discuss input validation decisions'));
    await page.goto(origin + '/workspaces');
    await page.getByLabel('Job posting URL', { exact: true }).fill(posting + '?utm_source=browser');
    await page.getByRole('button', { name: 'Preview import', exact: true }).click();
    await preview.getByText('A matching job is already saved.', { exact: false }).waitFor();
    assert.equal(await preview.getByRole('link', { name: 'Open existing workspace', exact: true }).getAttribute('href'), new URL(importedWorkspaceUrl).pathname);
    assert.equal(await page.getByRole('button', { name: 'Use preview in editable job form', exact: true }).count(), 0);
    pass('Public job API preview, editable save, reload persistence and duplicate detection');
  } finally { axios.get = originalGet; }

  await page.getByLabel('Job posting URL', { exact: true }).fill('https://example.test/jobs/manual-opportunity');
  await page.getByRole('button', { name: 'Preview import', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Automatic import supports' }).waitFor();
  await page.getByRole('button', { name: 'Enter job details manually', exact: true }).click();
  assert.equal(await page.getByLabel('Job link (optional)', { exact: true }).inputValue(), 'https://example.test/jobs/manual-opportunity');
  await page.getByLabel('Company', { exact: true }).fill('Phase Five Manual Co');
  await page.getByLabel('Role title', { exact: true }).fill('UI Designer');
  await page.getByLabel('Job description', { exact: true }).fill('Figma required. Onsite in Delhi.');
  await page.getByRole('button', { name: 'Create job workspace', exact: true }).click();
  await page.waitForURL(/\/workspaces\/[^/]+$/);
  await page.goto(origin + '/workspaces');
  await page.getByText('Opportunity preferences', { exact: true }).click();
  await page.getByLabel(/^Preferred roles/).fill('Python Engineer');
  await page.getByLabel(/^Preferred locations/).fill('Pune');
  await page.getByRole('checkbox', { name: 'remote', exact: true }).check();
  const preferencesSaved = page.waitForResponse((response) => response.url().includes('/workspaces/preferences') && response.request().method() === 'PUT');
  await page.getByRole('button', { name: 'Save opportunity preferences', exact: true }).click();
  assert.equal((await preferencesSaved).status(), 200);
  const rankedCard = page.getByRole('link', { name: importedTitle, exact: true }).locator('..');
  await rankedCard.getByText('Why this recommendation?', { exact: true }).click();
  await rankedCard.getByText(/Preferred location: Pune/).waitFor();
  assert((await rankedCard.innerText()).includes('Preferred role: Python Engineer'));
  assert((await rankedCard.innerText()).includes('Python'));
  await audit('phase5-opportunity-ranking'); await screenshot('phase5-opportunity-ranking');
  await page.reload(); await page.getByText('Opportunity preferences', { exact: true }).click();
  assert.equal(await page.getByLabel(/^Preferred roles/).inputValue(), 'Python Engineer');
  assert.equal(await page.getByRole('checkbox', { name: 'remote', exact: true }).isChecked(), true);
  assert.equal(await page.getByRole('link', { name: importedTitle, exact: true }).count(), 1);
  assert.equal(await page.getByRole('link', { name: 'UI Designer at Phase Five Manual Co', exact: true }).count(), 1);
  pass('Several saved opportunities share persisted preferences and explain evidence-based priorities');

  await page.goto(importedWorkspaceUrl);
  await page.getByRole('button', { name: 'Create preparation pack', exact: true }).click();
  await page.getByRole('heading', { name: 'Relevant project examples', exact: true }).waitFor();
  await page.getByRole('heading', { name: 'Interview topics', exact: true }).waitFor();
  const draftText = page.getByLabel('Draft text', { exact: true });
  assert((await draftText.inputValue()).includes(importedCompany));
  assert(!(await draftText.inputValue()).includes('[Add and confirm'));
  assert.equal(await page.getByRole('button', { name: 'Copy reviewed draft', exact: true }).isEnabled(), false);
  const coverLetter = (await draftText.inputValue()) + '\n\nThank you.';
  await draftText.fill(coverLetter);
  const draftSaved = page.waitForResponse((response) => response.url().endsWith('/pack') && response.request().method() === 'PUT');
  await page.getByRole('button', { name: 'Save draft', exact: true }).click(); assert.equal((await draftSaved).status(), 200);
  await page.reload(); await draftText.waitFor(); assert.equal(await draftText.inputValue(), coverLetter);
  await page.getByRole('checkbox', { name: 'I checked this draft against my actual experience', exact: true }).check();
  const reviewed = page.waitForResponse((response) => response.url().endsWith('/pack') && response.request().method() === 'PUT');
  await page.getByRole('button', { name: 'Mark draft reviewed', exact: true }).click(); assert.equal((await reviewed).status(), 200);
  await page.getByText('Draft reviewed and saved.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Copy reviewed draft', exact: true }).waitFor({ state: 'visible' });
  assert.equal(await page.getByRole('button', { name: 'Copy reviewed draft', exact: true }).isEnabled(), true);
  const packDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download preparation pack', exact: true }).click();
  const packText = await fs.readFile(await (await packDownload).path(), 'utf8');
  for (const expected of [importedCompany, 'Selected resume:', 'Relevant project examples', 'Interview topics', 'Preparation checklist', 'Evidence citations', 'Thank you.']) assert(packText.includes(expected), expected);
  await page.getByLabel('Preparation draft', { exact: true }).selectOption('recruiter');
  assert((await draftText.inputValue()).includes('Here are examples from my experience'));
  assert.equal(await page.getByRole('button', { name: 'Copy reviewed draft', exact: true }).isEnabled(), false);
  await page.getByRole('checkbox', { name: 'I checked this draft against my actual experience', exact: true }).check();
  const outreachReviewed = page.waitForResponse((response) => response.url().endsWith('/pack') && response.request().method() === 'PUT');
  await page.getByRole('button', { name: 'Mark draft reviewed', exact: true }).click(); assert.equal((await outreachReviewed).status(), 200);
  await page.getByText('Draft reviewed and saved.', { exact: true }).waitFor();
  await page.getByLabel('Preparation draft', { exact: true }).selectOption('recruiter');
  assert.equal(await page.getByRole('button', { name: 'Copy reviewed draft', exact: true }).isEnabled(), true);
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
  const outreachText = await draftText.inputValue();
  await page.getByRole('button', { name: 'Copy reviewed draft', exact: true }).click();
  await page.getByText('Reviewed draft copied. Paste it into your chosen messaging app when you are ready.', { exact: true }).waitFor();
  // Native Windows clipboards use CRLF; browsers expose textarea values as LF.
  assert.equal((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n'), outreachText.replace(/\r\n/g, '\n'));
  assert.equal(await page.getByRole('button', { name: /^Send/ }).count(), 0);
  await audit('phase5-preparation-and-reviewed-outreach'); await screenshot('phase5-preparation-pack');
  pass('Selected resume, cited projects, interview topics and checklist assemble into an editable reviewed pack; outreach remains under user control');

  const description = page.getByLabel('Job description', { exact: true });
  await description.fill((await description.inputValue()) + '\nPrepare a walkthrough of Python validation.'); await saved();
  await page.getByRole('alert').filter({ hasText: 'The job, resume or confirmed evidence changed.' }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Copy reviewed draft', exact: true }).isEnabled(), false);
  assert.equal(await page.getByRole('button', { name: 'Download preparation pack', exact: true }).isEnabled(), false);
  await page.getByRole('button', { name: 'Regenerate preparation pack', exact: true }).click();
  await page.getByText('Draft needs your review.', { exact: true }).waitFor();
  pass('Changing saved job requirements invalidates prior draft review and requires regenerated preparation');

  await page.getByRole('link', { name: 'Track application', exact: true }).click();
  const dialog = page.getByRole('dialog'); await dialog.waitFor();
  assert.equal(await dialog.getByLabel('Company Name *', { exact: true }).inputValue(), importedCompany);
  assert.equal(await dialog.getByLabel('Role Title *', { exact: true }).inputValue(), importedRole);
  assert.equal(await dialog.getByLabel('Job Posting Link', { exact: true }).inputValue(), posting);
  await dialog.getByRole('button', { name: 'Save Application', exact: true }).click(); await dialog.waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Edit ' + importedTitle, exact: true }).click();
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10), yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const interview = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10) + 'T14:30';
  await dialog.getByLabel('Application stage', { exact: true }).selectOption('interview');
  await dialog.getByLabel('Application deadline', { exact: true }).fill(tomorrow);
  await dialog.getByLabel('Follow-up date', { exact: true }).fill(yesterday);
  await dialog.getByLabel('Interview time (your local timezone)', { exact: true }).fill(interview);
  await dialog.getByLabel('Recruiter name', { exact: true }).fill('Fictional Recruiter');
  await dialog.getByLabel('Recruiter email', { exact: true }).fill('recruiter@example.test');
  await dialog.getByLabel('Recruiter phone', { exact: true }).fill('+1 555 010 5050');
  await dialog.getByLabel('Contact notes', { exact: true }).fill('Prefers an agenda before the interview.');
  await dialog.getByLabel('Timeline update / status reason', { exact: true }).fill('Recruiter confirmed a technical interview.');
  await dialog.getByRole('checkbox', { name: 'Show in-app reminders', exact: true }).check();
  await dialog.getByRole('checkbox', { name: 'Include calendar alerts in export', exact: true }).check();
  await dialog.getByLabel('Reminder lead time', { exact: true }).selectOption('15');
  await dialog.getByRole('button', { name: 'Save Application', exact: true }).click(); await dialog.waitFor({ state: 'hidden' });
  await page.goto(origin + '/applications'); await page.getByRole('button', { name: 'Edit ' + importedTitle, exact: true }).click();
  assert.equal(await dialog.getByLabel('Recruiter email', { exact: true }).inputValue(), 'recruiter@example.test');
  assert.equal(await dialog.getByLabel('Interview time (your local timezone)', { exact: true }).inputValue(), interview);
  await dialog.getByText('Recruiter confirmed a technical interview.', { exact: true }).waitFor();
  const attachmentContent = 'Fictional private project notes. Python input validation example.';
  await dialog.getByLabel('Upload attachment', { exact: true }).setInputFiles({ name: 'phase5-project-example.txt', mimeType: 'text/plain', buffer: Buffer.from(attachmentContent) });
  const attachmentButton = dialog.getByRole('button', { name: /^phase5-project-example\.txt \(/ }); await attachmentButton.waitFor();
  const attachmentDownload = page.waitForEvent('download'); await attachmentButton.click();
  assert.equal(await fs.readFile(await (await attachmentDownload).path(), 'utf8'), attachmentContent);
  // Upload increments the saved revision; the editor must keep that revision so
  // a subsequent ordinary save does not fail or overwrite the attachment.
  await dialog.getByLabel('Contact notes', { exact: true }).fill('Agenda received; bring project examples.');
  await dialog.getByRole('button', { name: 'Save Application', exact: true }).click(); await dialog.waitFor({ state: 'hidden' });
  await page.goto(origin + '/applications'); await page.getByRole('button', { name: 'Edit ' + importedTitle, exact: true }).click();
  await attachmentButton.waitFor(); assert.equal(await dialog.getByLabel('Contact notes', { exact: true }).inputValue(), 'Agenda received; bring project examples.');
  await audit('phase5-application-record'); await screenshot('phase5-application-record');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  const remindersPanel = page.getByRole('heading', { name: 'Upcoming reminders', exact: true }).locator('..').locator('..');
  await remindersPanel.getByRole('link', { name: 'Follow up: ' + importedTitle, exact: true }).waitFor();
  await remindersPanel.getByRole('link', { name: 'Interview: ' + importedTitle, exact: true }).waitFor();
  const calendarDownload = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export calendar (.ics)', exact: true }).click();
  const calendar = (await fs.readFile(await (await calendarDownload).path(), 'utf8')).replace(/\r\n /g, '');
  assert(calendar.includes('BEGIN:VCALENDAR')); assert(calendar.includes('BEGIN:VALARM')); assert(calendar.includes('TRIGGER:-PT15M')); assert(calendar.includes(importedTitle));
  const toUtcStamp = new Date(interview).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  assert(calendar.includes('DTSTART:' + toUtcStamp));
  await page.getByRole('button', { name: 'Edit ' + importedTitle, exact: true }).click();
  await dialog.getByRole('checkbox', { name: 'Show in-app reminders', exact: true }).uncheck();
  await dialog.getByRole('checkbox', { name: 'Include calendar alerts in export', exact: true }).uncheck();
  await dialog.getByRole('button', { name: 'Save Application', exact: true }).click(); await dialog.waitFor({ state: 'hidden' });
  await remindersPanel.getByRole('link', { name: 'Follow up: ' + importedTitle, exact: true }).waitFor({ state: 'detached' });
  await remindersPanel.getByRole('link', { name: 'Interview: ' + importedTitle, exact: true }).waitFor({ state: 'detached' });
  const silentCalendarDownload = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export calendar (.ics)', exact: true }).click();
  const silentCalendar = await fs.readFile(await (await silentCalendarDownload).path(), 'utf8'); assert(!silentCalendar.includes('BEGIN:VALARM'));
  await audit('phase5-reminder-preferences');
  pass('Workspace details transfer into applications; recruiter contacts, private attachment bytes, interview times and status timeline survive reload');
  pass('Deadlines, interviews and follow-ups appear as in-app reminders; calendar export preserves times and respects notification preferences');

  await page.getByText('Import or export applications', { exact: true }).click();
  const csv = 'company,roleTitle,status,jobLink,recruiterName,recruiterEmail,notes\n'
    + importedCompany + ',' + importedRole + ',interview,' + posting + ',Fictional Recruiter,recruiter@example.test,Already tracked\n'
    + 'Phase Five CSV Co,Platform Engineer,applied,https://example.test/jobs/csv,CSV Recruiter,csv@example.test,"Review ""project examples"", then follow up."\n'
    + 'Phase Five CSV Co,Platform Engineer,applied,https://example.test/jobs/csv,CSV Recruiter,csv@example.test,Repeated row\n'
    + 'Incomplete Company,,saved,,,,Missing role\n';
  await page.getByLabel('Choose application CSV file', { exact: true }).setInputFiles({ name: 'phase5-opportunities.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await page.getByRole('button', { name: 'Preview CSV import', exact: true }).click();
  const csvPreview = page.getByRole('region', { name: 'CSV import preview', exact: true });
  await csvPreview.getByText('4 row(s), 1 ready to import. Existing applications and repeated rows are skipped.', { exact: true }).waitFor();
  assert.equal(await csvPreview.getByRole('checkbox', { name: 'Import row 2', exact: true }).isEnabled(), false);
  assert.equal(await csvPreview.getByRole('checkbox', { name: 'Import row 3', exact: true }).isChecked(), true);
  assert.equal(await csvPreview.getByRole('checkbox', { name: 'Import row 4', exact: true }).isEnabled(), false);
  assert.equal(await csvPreview.getByRole('checkbox', { name: 'Import row 5', exact: true }).isEnabled(), false);
  await audit('phase5-csv-import-preview');
  await page.getByRole('button', { name: 'Import selected applications', exact: true }).click();
  await page.getByText('1 application(s) imported.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Edit Platform Engineer at Phase Five CSV Co', exact: true }).click();
  assert.equal(await dialog.getByLabel('Recruiter email', { exact: true }).inputValue(), 'csv@example.test');
  assert.equal(await dialog.getByLabel('Personal Notes / Interview Timeline', { exact: true }).inputValue(), 'Review "project examples", then follow up.');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Preview CSV import', exact: true }).click();
  await csvPreview.getByText('4 row(s), 0 ready to import. Existing applications and repeated rows are skipped.', { exact: true }).waitFor();
  assert.equal(await csvPreview.getByRole('checkbox', { name: 'Import row 3', exact: true }).isEnabled(), false);
  const csvDownload = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export applications CSV', exact: true }).click();
  const exportedCsv = await fs.readFile(await (await csvDownload).path(), 'utf8');
  for (const expected of ['recruiterEmail', 'calendarAlerts', importedCompany, 'Phase Five CSV Co', 'csv@example.test', '""project examples""']) assert(exportedCsv.includes(expected), expected);
  assert.equal((exportedCsv.match(/Phase Five CSV Co/g) || []).length, 1);
  pass('CSV preview flags existing and repeated jobs plus invalid rows; selective import preserves quoted notes and recruiter data without duplicates');

  await page.setViewportSize({ width: 390, height: 844 });
  for (const [route, heading] of [[importedWorkspaceUrl, 'Application preparation pack'], [origin + '/applications', 'Applications'], [origin + '/workspaces', 'Job workspaces']]) {
    await page.goto(route); await page.getByRole('heading', { name: heading, exact: true }).waitFor();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), heading + ' must fit a mobile viewport');
    await audit('phase5-mobile-' + heading.toLowerCase().replaceAll(' ', '-'));
  }
  await screenshot('phase5-mobile-workspaces'); await page.setViewportSize({ width: 1440, height: 1000 });
  pass('Application assistant, records and ranked workspaces fit a 390 px mobile viewport');
  await page.goto(workspaceUrl);
};
