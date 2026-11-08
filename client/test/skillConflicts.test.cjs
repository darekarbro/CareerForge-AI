const { test, beforeEach, afterEach } = require('node:test'), assert = require('node:assert/strict');
const h = require('./helpers.cjs'), { React, load, render, screen } = h;
beforeEach(() => { h.reset(); h.session('A'); }); afterEach(() => { h.cleanup(); h.auth.getState().logout(false); });

test('requirement matching displays both sides of a conflict without presenting it as supported', () => {
  const Panel = load('components/ResumeEditor/RequirementMatchPanel.js').default;
  render(React.createElement(Panel, { report: { matchScore: 0, requirementMatches: [{ id: 'react', label: 'React', category: 'required_skill', status: 'uncertain', sourceText: 'React required.', explanation: 'Conflicting statements require review.', supportingEvidence: [{ path: 'skillConflicts[0].positiveEvidence[0].quote', quote: 'React' }], conflictingEvidence: [{ path: 'summary', quote: 'I do not know React.' }], missingEvidence: 'Clarify your actual React experience.' }] } }));
  assert(screen.getByText('Needs clarification')); assert(screen.getByText('Positive claim to review')); assert(screen.getByText('Denial to review'));
  assert(screen.getByText('I do not know React.')); assert(screen.getByText('Source: Original extracted claim, withheld pending review'));
  assert.equal(screen.queryByText('Evidence found'), null); assert.equal(screen.queryByText('Supporting resume evidence'), null);
});

test('source review separates withheld claims from editable facts and shows both quotes', () => {
  const Panel = load('components/ResumeEditor/SourceComparison.js').default;
  const conflict = { skill: 'React', positiveEvidence: [{ quote: 'Listed React in skills.' }], negativeEvidence: [{ path: 'summary', quote: 'I do not know React.' }] };
  render(React.createElement(Panel, { review: { resumeId: 'r1', fileType: 'txt', originalAvailable: false, sourceLabel: 'Source text', sourceText: 'Skills: React\nSummary: I do not know React.', content: { summary: 'I do not know React.', skills: { all: [] }, skillConflicts: [conflict] }, skillConflicts: [conflict], issues: [{ path: ['skills'], reason: 'React is both claimed and denied.' }], warnings: [] } }));
  assert(screen.getByRole('region', { name: 'Conflicting skill claims' })); assert(screen.getByRole('heading', { name: 'Skills needing clarification' }));
  assert(screen.getByText('Listed React in skills.')); assert(screen.getAllByText('I do not know React.').length > 0);
  assert.equal(screen.queryByText(/skill Conflicts \/ 1/), null); assert(screen.getByText('React is both claimed and denied.'));
});
