const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
// A short browser recording with fictional, preloaded source facts. No pilot claim.
module.exports = async ({ page, saved, screenshot, pass, report }) => {
  const auth = require('../../server/src/services/authService');
  const account = await auth.register({ name: 'Demo Candidate', email: 'phase6-demo@example.test', password: 'fictional-demo-password' });
  await require('../../server/src/models/User').updateOne({ _id: account.user.id }, { $set: { emailVerifiedAt: new Date() } });
  const content = { contactInfo: { name: 'Demo Candidate', email: 'phase6-demo@example.test' }, summary: 'Built Python validation tools and React forms for a fictional course project.',
    skills: { all: ['React', 'Python', 'Git'], technical: ['React', 'Python'], tools: ['Git'] }, workExperience: [], education: [], certifications: [],
    projects: [{ title: 'Course Import Tool', description: 'Built a Python validator and React error display.', technologies: ['Python', 'React'], highlights: ['Tested malformed input and displayed validation errors.'] }] };
  const resume = await require('../../server/src/models/Resume').create({ owner: account.user.id, title: 'Fictional demo source', rawText: JSON.stringify(content), parsedData: content, processingStatus: 'COMPLETED', verifiedAt: new Date() });
  const origin = 'http://localhost:3030', pause = () => page.waitForTimeout(1700);
  await page.goto(origin + '/login');
  await page.getByLabel('Email Address', { exact: true }).fill('phase6-demo@example.test');
  await page.getByLabel('Password', { exact: true }).fill('fictional-demo-password');
  await page.getByRole('button', { name: 'Sign In To Platform', exact: true }).click(); await page.waitForURL('**/dashboard');
  await page.goto(origin + '/resume/' + resume._id); await page.getByRole('link', { name: /Tailor For Role/i }).waitFor(); await pause();
  await screenshot('phase6-source');
  await page.goto(origin + '/resume/' + resume._id + '/tailor');
  await page.getByRole('button', { name: 'Backend Engineer', exact: true }).click();
  await page.getByPlaceholder('Paste specific job requirements or responsibilities here to align bullet points...').fill('Python required. Test malformed input. React and Git preferred.'); await pause();
  await page.getByRole('button', { name: 'Generate Role-Tailored Resume', exact: true }).click();
  await page.getByRole('heading', { name: 'Preview and export', exact: true }).waitFor();
  const accepts = page.getByRole('button', { name: 'Accept', exact: true });
  assert(await accepts.count() > 0, 'Demo must show an actual suggestion review');
  for (let index = 0; index < await accepts.count(); index++) { if (index === 0) await pause(); await accepts.nth(index).click(); }
  await saved(); await pause(); await screenshot('phase6-review');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PDF', exact: true }).click();
  const file = await download; assert((await fs.stat(await file.path())).size > 1000); pass('Fictional source, real generation, explicit review and successful PDF export');
  await page.goto(origin + '/activity'); await page.getByRole('link', { name: 'View progress', exact: true }).first().click();
  await page.getByText('Technical processing details', { exact: true }).click(); await page.getByText(/Trace: [a-f0-9]{32}/).waitFor(); await pause();
  await screenshot('phase6-activity'); pass('Activity shows trace correlation, queue time, execution and daily budget');
  await page.goto(origin + '/account'); await pause();
  const root = path.resolve(__dirname, '../..'), media = path.join(root, 'docs/media'); await fs.mkdir(media, { recursive: true });
  for (const name of ['source', 'review', 'activity']) await fs.copyFile(path.join(root, '.test-tmp/browser-phase6-' + name + '.png'), path.join(media, 'phase6-' + name + '.png'));
  report.boundary = 'fictional preloaded source; real local UI/API/PDF; deterministic AI; automated demonstration, no pilot participants';
};
