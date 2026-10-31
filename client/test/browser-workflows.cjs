// Uses a private temporary database and fictional accounts. No external AI keys are loaded.
const assert = require('node:assert/strict'), fs = require('node:fs/promises'), path = require('node:path'), http = require('node:http');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '../..'), testRoot = path.join(root, '.test-tmp');
process.env.CLIENT_URL = 'http://localhost:3030'; process.env.AUTH_RATE_LIMIT_MAX = '1000'; process.env.AI_RATE_LIMIT_MAX = '1000';
require('../../server/test/setup.cjs');
process.env.CLIENT_URL = 'http://localhost:3030';
const { MongoMemoryServer } = require('../../server/node_modules/mongodb-memory-server');
const { connectDB, disconnectDB } = require('../../server/src/config/db');
const { initSocket, closeSocket } = require('../../server/src/config/socket');
const { closeQueue } = require('../../server/src/queues/processingQueue');
const app = require('../../server/src/app');
const { chromium } = require('playwright');
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let db, apiServer, frontend, browser, page, directory, log = '', failed = false;
const errors = [];
const report = { data: 'fictional only', checks: [], screenshots: [] };
const pass = (name) => { report.checks.push(name); console.log('PASS ' + name); };
async function saved() {
  const button = page.getByRole('button', { name: 'Save now', exact: true });
  if (await button.isEnabled()) await button.click();
  await page.getByText('All changes saved', { exact: true }).waitFor();
}
async function screenshot(name) { const filename = 'browser-' + name + '.png'; await page.screenshot({ path: path.join(testRoot, filename), fullPage: true }); report.screenshots.push(filename); }
async function start() {
  await fs.mkdir(testRoot, { recursive: true }); directory = await fs.mkdtemp(path.join(testRoot, 'browser-mongo-'));
  const binary = process.env.MONGOMS_SYSTEM_BINARY || path.join(root, 'server/node_modules/.cache/mongodb-memory-server/mongod-x64-win32-7.0.24.exe');
  db = new MongoMemoryServer({ binary: await fs.stat(binary).then(() => ({ systemBinary: binary }), () => ({})), instance: { dbPath: directory, ip: '127.0.0.1', launchTimeout: 60000, args: ['--wiredTigerCacheSizeGB', '0.25'] } });
  await db.start();
  await connectDB({ uri: db.getUri() });
  apiServer = http.createServer(app); initSocket(apiServer, process.env.CLIENT_URL);
  await new Promise((resolve, reject) => { apiServer.once('error', reject); apiServer.listen(5000, resolve); });
  frontend = spawn(process.execPath, [path.join(root, 'client/node_modules/next/dist/bin/next'), 'start', '-p', '3030'], {
    cwd: path.join(root, 'client'), windowsHide: true, env: { ...process.env, NODE_ENV: 'production', NODE_OPTIONS: '--max-old-space-size=512' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  frontend.stdout.on('data', (data) => { log = (log + data).slice(-10000); }); frontend.stderr.on('data', (data) => { log = (log + data).slice(-10000); });
  const deadline = Date.now() + 30000;
  while (true) {
    if (frontend.exitCode !== null) throw new Error('Frontend stopped: ' + log);
    try { const response = await fetch('http://localhost:3030/login'); if (response.ok) break; } catch { /* Wait until the local frontend accepts requests. */ }
    if (Date.now() > deadline) throw new Error('Frontend did not start: ' + log);
    await pause(250);
  }
  const executablePath = process.env.BROWSER_PATH || (await fs.stat('C:/Program Files/Google/Chrome/Application/chrome.exe').then(() => 'C:/Program Files/Google/Chrome/Application/chrome.exe', () => undefined));
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  await page.context().tracing.start({ screenshots: true, snapshots: true });
  page.setDefaultTimeout(20000); page.on('pageerror', (error) => errors.push(error.message));
}
async function run() {
  await page.goto('http://localhost:3030/register');
  await page.getByPlaceholder('e.g. Alex Morgan').fill('Browser Candidate');
  await page.getByPlaceholder('alex@example.com').fill('browser-candidate@example.test');
  await page.getByPlaceholder('Minimum 8 characters').fill('fictional-browser-password');
  await page.getByRole('button', { name: 'Create Free Account', exact: true }).click();
  await page.waitForURL('**/onboarding'); await page.getByLabel('Target role', { exact: true }).fill('Backend Engineer');
  await page.getByRole('combobox', { name: /^Experience level/ }).selectOption('student');
  await page.getByRole('button', { name: 'Save goal and build my profile' }).click();
  await page.waitForURL('**/profile'); await page.getByLabel('Full name', { exact: true }).waitFor();
  await page.getByLabel('Phone', { exact: true }).fill('+1 555 010 1111');
  await page.getByRole('button', { name: 'Summary', exact: true }).click();
  await page.getByLabel('Professional summary', { exact: true }).fill('Graduate developer who built JavaScript interfaces and Python input validation projects.');
  await page.getByRole('button', { name: 'Skills', exact: true }).click();
  await page.getByLabel('Technical skills', { exact: true }).fill('JavaScript, Python');
  await page.getByLabel('Frameworks', { exact: true }).fill('React');
  await page.getByLabel('Tools and platforms', { exact: true }).fill('Git');
  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  await page.getByRole('button', { name: 'Add project', exact: true }).click();
  await page.getByLabel('Project name 1', { exact: true }).fill('Browser Validation Project');
  await page.getByLabel('Project purpose and your contribution 1', { exact: true }).fill('Built Python validation and a React interface for a course data import project.');
  await page.getByLabel('Project technologies 1', { exact: true }).fill('Python, React');
  await page.getByLabel('Achievements 1', { exact: true }).fill('Wrote Python validation rules for malformed input.\nBuilt a React form for displaying input errors.');
  await saved(); await screenshot('profile'); pass('Registration, onboarding and editable profile autosave');
  await page.getByRole('button', { name: 'Create resume from saved profile', exact: true }).click();
  await page.waitForURL(/\/resume\/[^/]+\/edit$/);
  const resumeId = page.url().match(/\/resume\/([^/]+)/)[1];
  await page.getByLabel('Resume name', { exact: true }).fill('Browser verified resume'); await saved();
  await page.reload(); await page.getByLabel('Resume name', { exact: true }).waitFor();
  assert.equal(await page.getByLabel('Resume name', { exact: true }).inputValue(), 'Browser verified resume');
  pass('Resume editing persists after a full page reload');
  await page.goto('http://localhost:3030/account');
  await page.getByRole('button', { name: 'Resend verification email' }).waitFor();
  assert.equal(await page.getByRole('checkbox', { name: 'Groq', exact: true }).isChecked(), false);
  const verification = require('../../server/src/services/accountMailService').testMessages.findLast((item) => item.to === 'browser-candidate@example.test' && item.subject.startsWith('Verify')).text.match(/#token=([a-f0-9]{64})/)[1];
  await page.goto('http://localhost:3030/verify-email#token=' + verification);
  await page.getByRole('button', { name: 'Verify email', exact: true }).click(); await page.getByText('Email verified. You can now use AI features.', { exact: true }).waitFor();
  await page.goto('http://localhost:3030/account'); await page.getByRole('checkbox', { name: 'Groq', exact: true }).check();
  await page.getByRole('button', { name: 'Save privacy preferences' }).click(); await page.getByText('Privacy preferences saved.', { exact: true }).waitFor();
  pass('Email verification and explicit AI provider sharing controls');
  await page.goto('http://localhost:3030/workspaces');
  await page.getByLabel('Company', { exact: true }).fill('Browser Target Co');
  await page.getByLabel('Role title', { exact: true }).fill('Backend Engineer');
  await page.getByLabel('Job description', { exact: true }).fill('Python required. React and Git preferred. Docker required.');
  await page.getByRole('combobox', { name: /^Resume/ }).selectOption(resumeId);
  await page.getByRole('button', { name: 'Create job workspace' }).click(); await page.waitForURL(/\/workspaces\/[^/]+$/);
  const workspaceUrl = page.url();
  await page.getByRole('button', { name: 'Check job match', exact: true }).click();
  await page.getByRole('heading', { name: /^Job match:/ }).waitFor(); await screenshot('workspace');
  await page.getByRole('button', { name: 'Tailor resume', exact: true }).click();
  await page.waitForURL(/\/resume\/[^/]+\/tailor\?version=/); await page.getByText('Resume ready for your review', { exact: true }).waitFor();
  const keep = page.getByRole('button', { name: 'Keep original', exact: true });
  if (await keep.count()) { await keep.first().click(); await saved(); }
  await page.getByRole('button', { name: 'Summary', exact: true }).click();
  await page.getByLabel('Professional summary', { exact: true }).fill('Verified browser review: JavaScript interfaces and Python data validation projects.'); await saved();
  await page.getByRole('button', { name: 'Preview PDF and page count', exact: true }).click();
  await page.getByText(/pages? · Saved edit revision/).waitFor(); assert(await page.getByTitle('Actual resume PDF preview').isVisible());
  const downloaded = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download DOCX', exact: true }).click();
  const download = await downloaded; assert((await fs.stat(await download.path())).size > 1000);
  await screenshot('review'); pass('Saved job match, per-change review, manual edits, actual PDF preview and DOCX download');
  await page.goto(workspaceUrl); await page.getByRole('link', { name: 'Track application', exact: true }).click();
  const dialog = page.getByRole('dialog'); await dialog.waitFor();
  await dialog.getByLabel('Application deadline', { exact: true }).fill('2026-12-01');
  await dialog.getByLabel('Follow-up date', { exact: true }).fill('2026-11-01');
  await dialog.getByLabel('Personal Notes / Interview Timeline', { exact: true }).fill('Fictional follow-up note for browser testing.');
  await dialog.getByRole('button', { name: 'Save Application', exact: true }).click(); await dialog.waitFor({ state: 'hidden' });
  await page.getByLabel('Search company or role', { exact: true }).fill('Browser Target');
  await page.getByRole('button', { name: 'Edit Backend Engineer at Browser Target Co', exact: true }).click();
  await page.getByText(/Saved resume: version/).waitFor(); await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  pass('Application search, deadlines, notes and exact saved resume revision');
  await page.goto(workspaceUrl); await page.getByRole('link', { name: 'Practice for this job', exact: true }).click();
  await page.getByRole('combobox', { name: /^Difficulty/ }).selectOption('Hard'); await page.getByRole('combobox', { name: /^Questions/ }).selectOption('3');
  await page.getByRole('combobox', { name: /^Practice timer per question/ }).selectOption('60');
  await page.getByRole('combobox', { name: /^Feedback/ }).selectOption('end');
  await page.getByRole('button', { name: 'Start practice', exact: true }).click(); await page.waitForURL(/\/interview\/session\/[^/]+$/);
  await page.getByRole('timer').waitFor(); await screenshot('interview');
  for (let index = 1; index <= 3; index++) {
    await page.getByRole('button', { name: new RegExp('^Q' + index + '(?: |$)') }).click();
    await page.getByRole('textbox').fill('I define requirements and constraints, compare alternatives and trade-offs, implement validation, and use tests to verify failure recovery. My course project used Python and React to show input errors before data import.');
    await page.getByRole('button', { name: 'Submit answer', exact: true }).click(); await page.getByText('Your Submitted Answer:', { exact: true }).waitFor();
  }
  await page.getByText('Answered: 3 of 3 questions completed', { exact: true }).waitFor();
  await page.getByRole('button', { name: /^Q1/ }).click(); await page.getByRole('button', { name: 'Try this answer again', exact: true }).click();
  await page.getByRole('textbox').fill('I define the goal, requirements and constraints, compare alternatives and trade-offs, then implement and test the chosen contract. I validate malformed input, monitor failures and document recovery steps. In my project I used Python validation and React error messages.');
  await page.getByRole('button', { name: 'Submit improved answer', exact: true }).click();
  await page.getByText('Answered: 3 of 3 questions completed', { exact: true }).waitFor(); await page.getByText('Previous attempts (1)', { exact: true }).waitFor();
  pass('Job-specific difficulty, persistent timer, delayed feedback and answer retry');
  await page.goto('http://localhost:3030/activity'); await page.getByRole('heading', { name: 'Usage in the last 24 hours', exact: true }).waitFor();
  await page.getByRole('link', { name: 'View progress', exact: true }).first().click(); await page.getByRole('link', { name: 'Open result', exact: true }).waitFor();
  pass('Activity, usage and reopening persisted results');
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('http://localhost:3030/profile'); await page.getByRole('heading', { name: 'My career profile', exact: true }).waitFor();
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.getByRole('button', { name: 'Toggle navigation', exact: true }).click(); await page.getByRole('button', { name: 'Close navigation', exact: true }).waitFor();
  await page.keyboard.press('Escape'); assert.equal(await page.getByRole('button', { name: 'Toggle navigation', exact: true }).getAttribute('aria-expanded'), 'false');
  await screenshot('mobile'); pass('Mobile layout and keyboard navigation');
  await page.getByTitle('Logout', { exact: true }).click(); await page.waitForURL('**/login'); await page.goto('http://localhost:3030/profile'); await page.waitForURL('**/login');
  assert.equal(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('careerforge:draft:')).length), 0);
  assert.deepEqual(errors, []); pass('Logout clears private drafts and protected routes redirect');
  await page.getByRole('link', { name: 'Forgot password?' }).click(); await page.getByLabel('Email address', { exact: true }).fill('browser-candidate@example.test');
  await page.getByRole('button', { name: 'Send recovery link' }).click(); await page.getByRole('status').waitFor();
  const reset = require('../../server/src/services/accountMailService').testMessages.findLast((item) => item.to === 'browser-candidate@example.test' && item.subject.startsWith('Reset')).text.match(/#token=([a-f0-9]{64})/)[1];
  await page.goto('http://localhost:3030/reset-password#token=' + reset);
  await page.getByLabel('New password', { exact: true }).fill('replacement-browser-password'); await page.getByLabel('Confirm new password', { exact: true }).fill('replacement-browser-password');
  await page.getByRole('button', { name: 'Reset password', exact: true }).click(); await page.getByText('Password updated. All devices have been signed out.', { exact: true }).waitFor();
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Email Address', { exact: true }).fill('browser-candidate@example.test'); await page.getByLabel('Password', { exact: true }).fill('replacement-browser-password');
  await page.getByRole('button', { name: 'Sign In To Platform', exact: true }).click(); await page.waitForURL('**/dashboard');
  pass('Forgot password, single-use recovery link and sign-in with replacement password');
  await page.goto('http://localhost:3030/account'); await page.getByLabel('Current password', { exact: true }).fill('replacement-browser-password');
  const archiveDownload = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download account archive' }).click();
  const archive = await archiveDownload; assert((await fs.stat(await archive.path())).size > 1000);
  await screenshot('account-mobile'); pass('Private account ZIP export and mobile account controls');
  await page.getByLabel('Current password', { exact: true }).fill('replacement-browser-password'); await page.getByLabel('Type DELETE to confirm', { exact: true }).fill('DELETE');
  await page.getByRole('button', { name: 'Delete my account', exact: true }).click(); await page.waitForURL('**/account-deletion#receipt=*');
  await pause(100); await require('../../server/src/services/privacyService').sweepDeletions();
  await page.getByRole('button', { name: 'Check deletion status' }).click(); await page.getByText(/Status: completed/).waitFor();
  assert.deepEqual(errors, []); pass('Permanent account deletion and private completion receipt');
}
(async () => {
  try { await start(); await run(); }
  catch (error) { failed = true; report.error = error.message; console.error(error.stack); if (page) { await screenshot('failure').catch(() => {}); } }
  finally {
    if (page) await page.context().tracing.stop({ path: path.join(testRoot, 'browser-trace.zip') }).catch(() => {});
    await browser?.close(); frontend?.kill(); await closeSocket();
    if (apiServer?.listening) await new Promise((resolve) => apiServer.close(resolve));
    await closeQueue(); await disconnectDB(); await db?.stop();
    if (directory && path.resolve(directory).startsWith(testRoot + path.sep)) await fs.rm(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 }).catch((error) => { report.cleanupError = error.code; failed = true; });
    report.passed = !failed; await fs.writeFile(path.join(testRoot, 'browser-results.json'), JSON.stringify(report, null, 2));
    process.exitCode = failed ? 1 : 0;
  }
})();
