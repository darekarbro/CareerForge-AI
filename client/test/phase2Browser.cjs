const assert = require('node:assert/strict');
const assertContrast = require('./conflictContrast.cjs');
module.exports = ({ page, saved, screenshot, pass, audit }) => ({
  async profile() {
    await page.getByText('Build stronger experience with guided questions', { exact: true }).click();
    await page.getByLabel('Guided project name', { exact: true }).fill('Accessibility Notes');
    await page.getByLabel('What problem or assignment did the team need to solve?', { exact: true }).fill('Review keyboard support in course interfaces.');
    await page.getByLabel('What did you personally build, investigate or test?', { exact: true }).fill('I tested form labels and documented keyboard navigation.');
    await page.getByLabel('Which tools or methods did you actually use?', { exact: true }).fill('Chrome, JavaScript');
    await page.getByRole('button', { name: 'Add my verified details to draft', exact: true }).click();
    await page.getByLabel('Name this revision', { exact: true }).fill('Verified course contributions'); await saved();
    await page.getByText('Section order', { exact: true }).click();
    await page.getByRole('button', { name: 'Move up: Projects', exact: true }).focus(); await page.keyboard.press('Enter'); await saved();
    await page.getByText('Revision history and comparison', { exact: true }).click();
    await page.getByRole('button', { name: 'Compare revisions', exact: true }).click(); await page.getByRole('region', { name: 'Revision comparison' }).waitFor();
    await audit('profile-guidance-and-history'); await screenshot('phase2-guidance'); pass('Guided contribution questions, named history, comparison and keyboard section ordering');
  },
  async importsAndConflicts(resumeId) {
    await page.getByRole('button', { name: 'Summary', exact: true }).click();
    await page.getByLabel('Professional summary', { exact: true }).fill('Verified import summary: Python validation and accessible React forms.'); await saved();
    await page.getByRole('button', { name: 'Compare with original source', exact: true }).click();
    await page.getByRole('heading', { name: 'Extracted fields', exact: true }).waitFor(); await audit('source-comparison');
    await page.goto('http://localhost:3030/profile');
    await page.getByRole('combobox', { name: /^Import facts from a resume/ }).selectOption(resumeId); await page.getByRole('button', { name: 'Review import', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Summary', exact: true }).check(); await audit('selective-import');
    await page.getByRole('button', { name: 'Apply selected facts to profile draft', exact: true }).click(); await saved();
    await page.getByRole('button', { name: 'Summary', exact: true }).click(); assert.equal(await page.getByLabel('Professional summary', { exact: true }).inputValue(), 'Verified import summary: Python validation and accessible React forms.');
    const account = await require('../../server/src/models/User').findOne({ email: 'browser-candidate@example.test' });
    const profiles = require('../../server/src/services/profileService'), remote = await profiles.getProfile(account._id);
    const content = JSON.parse(JSON.stringify(remote.content)); content.summary = 'Remote changed summary'; content.contactInfo.phone = '+1 555 010 2222';
    await profiles.saveProfile(account._id, { revision: remote.revision, content, targetRole: remote.targetRole, experienceLevel: remote.experienceLevel, onboardingCompleted: true, presentation: remote.presentation, revisionName: 'Other device' });
    await page.getByLabel('Professional summary', { exact: true }).fill('My resolved summary retains my verified contribution.');
    await page.getByRole('button', { name: 'Save now', exact: true }).click();
    await page.getByRole('button', { name: 'Resolve changes without losing my draft', exact: true }).click();
    const apply = page.getByRole('button', { name: 'Use resolved draft', exact: true });
    assert(await apply.isDisabled()); await apply.hover(); await assertContrast(apply, 'disabled hover'); await audit('field-conflicts-disabled');
    await page.getByRole('radio', { name: /Keep my change/ }).check(); assert(await apply.isEnabled());
    await apply.focus(); await assertContrast(apply, 'enabled focus'); await audit('field-conflicts');
    await apply.hover(); await assertContrast(apply, 'enabled hover'); await audit('field-conflicts-hover');
    await page.getByRole('radio', { name: /Keep my change/ }).hover(); await assertContrast(apply, 'enabled hover exit');
    await screenshot('phase2-field-conflicts');
    pass('Conflict action maintains readable contrast through disabled, enabled, focus and hover states');
    await apply.click(); await saved();
    await page.getByRole('button', { name: 'Contact', exact: true }).click(); assert.equal(await page.getByLabel('Phone', { exact: true }).inputValue(), '+1 555 010 2222');
    await screenshot('phase2-conflict-resolved'); pass('Source comparison, selective import and field-level conflict resolution preserve independent remote changes');
  },
  async workspace() {
    await page.getByRole('checkbox', { name: 'Include Accessibility Notes', exact: true }).uncheck(); await saved();
    await page.getByRole('checkbox', { name: 'Research the company', exact: true }).check();
    await page.getByRole('button', { name: 'Archive workspace', exact: true }).click(); await page.getByRole('button', { name: 'Restore workspace', exact: true }).waitFor();
    assert(await page.getByRole('button', { name: 'Tailor resume', exact: true }).isDisabled());
    await page.getByRole('link', { name: 'All jobs', exact: true }).click(); await page.getByRole('combobox', { name: /^Workspace view/ }).selectOption('archived');
    await page.getByRole('link', { name: /Backend Engineer/ }).click(); await page.getByRole('button', { name: 'Restore workspace', exact: true }).click();
    await page.getByRole('button', { name: 'Archive workspace', exact: true }).waitFor(); assert(await page.getByRole('checkbox', { name: 'Research the company', exact: true }).isChecked());
    assert.equal(await page.getByRole('checkbox', { name: 'Include Accessibility Notes', exact: true }).isChecked(), false);
    await audit('workspace-selection-and-checklist'); pass('Job-specific entry selection, preparation checklist and archive/restore persist without data loss');
  },
  async layout() {
    await page.getByRole('combobox', { name: 'Template', exact: true }).selectOption('compact');
    await page.getByRole('checkbox', { name: 'Education', exact: true }).check(); await page.getByRole('button', { name: 'Save layout for this version', exact: true }).click();
    await page.getByText('Layout preferences saved for this version.', { exact: true }).waitFor();
    await page.reload(); await page.getByRole('combobox', { name: 'Template', exact: true }).waitFor(); assert.equal(await page.getByRole('combobox', { name: 'Template', exact: true }).inputValue(), 'compact'); assert(await page.getByRole('checkbox', { name: 'Education', exact: true }).isChecked());
    await audit('ai-review-and-saved-export'); pass('Saved version layouts and page-break controls survive reload');
  },
});
