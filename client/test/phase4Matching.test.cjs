const { test, beforeEach, afterEach } = require('node:test'), assert = require('node:assert/strict');
const h = require('./helpers.cjs'), { React, load, render, screen, fireEvent } = h;
beforeEach(() => { h.reset(); h.session('A'); }); afterEach(() => { h.cleanup(); h.auth.getState().logout(false); });

test('Phase 4: job match displays source evidence, missing requirements and unresolved constraints separately', () => {
  const Panel = load('components/ResumeEditor/RequirementMatchPanel.js').default;
  render(React.createElement(Panel, { report: { matchScore: 60, requirementMatches: [
    { id: 'r1', category: 'required_skill', label: 'Python', sourceText: 'Python required.', status: 'supported', supportingEvidence: [{ path: 'projects.0.description', quote: 'Built Python input validation.' }], explanation: 'Required skill has a source mention.' },
    { id: 'r2', category: 'preferred_skill', label: 'Docker', sourceText: 'Docker preferred.', status: 'missing', missingEvidence: 'Add an example if you have used Docker.', explanation: 'Preferred skills carry a lower weight.' },
    { id: 'r3', category: 'constraint', label: 'On-site', sourceText: 'On-site three days per week.', status: 'uncertain', missingEvidence: 'Confirm your availability.', explanation: 'Your resume cannot confirm willingness to commute.' },
  ], rubric: { version: 'v2', limitations: ['Skill mentions do not verify competence.'] } } }));
  assert(screen.getByRole('heading', { name: 'Job match: 60%' })); assert(screen.getByText('Evidence found')); assert(screen.getByText('Evidence missing')); assert(screen.getByText('Needs clarification'));
  assert(screen.getByText('Built Python input validation.')); assert(screen.getByText('Source: projects.0.description')); assert(screen.getByText('Confirm your availability.'));
  fireEvent.click(screen.getByText('Rubric and limitations')); assert(screen.getByText('Skill mentions do not verify competence.'));
});

test('Phase 4: saved legacy match reports prompt a fresh assessment instead of inventing requirement evidence', () => {
  const Panel = load('components/ResumeEditor/RequirementMatchPanel.js').default;
  render(React.createElement(Panel, { report: { matchScore: 40, mustHaveMissing: [{ skill: 'SQL', recommendation: 'Practise a join.' }] } }));
  assert(screen.getByText(/Run Check job match again/)); assert(screen.getByText(/Practise a join/)); assert.equal(screen.queryByText('Evidence found'), null);
});
