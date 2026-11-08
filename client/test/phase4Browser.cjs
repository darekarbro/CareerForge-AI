const assert = require('node:assert/strict');
module.exports = ({ page, screenshot, pass, audit }) => ({
  async matching() {
    const panel = page.getByRole('region', { name: 'Job requirement assessment' });
    await panel.getByRole('heading', { name: 'Required skills', exact: true }).waitFor();
    await panel.getByRole('heading', { name: 'Preferred skills', exact: true }).waitFor();
    assert(await panel.getByText('Evidence found', { exact: true }).count() > 0);
    assert(await panel.getByText('Evidence missing', { exact: true }).count() > 0);
    assert(await panel.locator('blockquote').count() > 0);
    await panel.getByText('Rubric and limitations', { exact: true }).click();
    await audit('phase4-requirement-evidence');
    pass('Phase 4: job requirement categories, supporting quotes, missing evidence and rubric limitations');
  },
  async progress() {
    await page.goto('http://localhost:3030/interview/history');
    await page.getByRole('link', { name: 'View competency evidence and learning plan', exact: true }).click();
    await page.getByText(/^Answers behind /).first().waitFor();
    await page.getByText(/^Answers behind /).first().click();
    const link = page.getByRole('link', { name: / · Attempt / }).first();
    const href = await link.getAttribute('href');
    assert(href.includes('?question=') && href.includes('&attempt='));
    const milestones = page.getByRole('heading', { name: 'Small project milestones', exact: true }).first();
    const hasMilestones = await milestones.waitFor({ timeout: 20000 }).then(() => true).catch(() => false);
    if (!hasMilestones) await page.getByText(/Your next practice tasks appear after assessed answers or a saved job gap analysis\./).waitFor();
    await screenshot('phase4-progress'); await audit('phase4-competencies-learning');
    await link.click(); await page.getByText('Your Submitted Answer:', { exact: true }).waitFor();
    pass('Phase 4: longitudinal competency evidence opens the original question and attempt');
    await page.goto('http://localhost:3030/interview/progress');
    if (hasMilestones) await page.getByRole('button', { name: /^Reassess / }).first().click();
    else await page.getByRole('link', { name: 'Start practice', exact: true }).click();
    await page.waitForURL(/\/interview\/(?:session\/[^/?#]+|setup(?:\?[^#]*)?)$/);
    pass(hasMilestones
      ? 'Phase 4: gap-specific tasks, project milestones and reassessment navigation'
      : 'Phase 4: unassessed-only guidance routes to start practice');
  },
});
