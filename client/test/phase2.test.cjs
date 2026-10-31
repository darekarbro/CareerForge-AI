const { test, beforeEach, afterEach } = require('node:test'), assert = require('node:assert/strict');
const h = require('./helpers.cjs'), { React, load, render, screen, fireEvent, waitFor, api, respond } = h;
const tools = load('services/resumeTools.js'), { normalizeContent } = load('components/ResumeEditor/ResumeEditor.js');
const { importUnits, mergeImport } = load('services/importMerge.js');
beforeEach(() => { h.reset(); h.session('A'); }); afterEach(() => { h.cleanup(); h.auth.getState().logout(false); });
const base = () => ({ content: normalizeContent({ contactInfo: { name: 'Fictional Candidate', phone: '111' }, summary: 'Original summary', projects: [{ entryId: 'one', title: 'First project', description: 'Original contribution', highlights: [] }, { entryId: 'two', title: 'Second project', description: 'Second contribution', highlights: [] }] }), revisionName: 'Initial facts' });
const copy = tools.copy;
test('Phase 2: three-way merge combines independent fields and resolves overlapping fields without losing entries', () => {
  const before = base(), mine = copy(before), theirs = copy(before);
  mine.content.summary = 'My summary'; mine.content.projects[0].description = 'My contribution';
  theirs.content.contactInfo.phone = '222'; theirs.content.projects[0].description = 'Remote contribution';
  const plan = tools.mergePlan(before, mine, theirs); assert.equal(plan.conflicts.length, 1);
  assert.match(plan.conflicts[0].label, /First project.*description/);
  const resolved = tools.resolvePlan(plan, { 0: 'mine' }); assert.equal(resolved.content.summary, 'My summary'); assert.equal(resolved.content.contactInfo.phone, '222'); assert.equal(resolved.content.projects[0].description, 'My contribution'); assert.equal(resolved.content.projects[1].entryId, 'two');
});
test('Phase 2: entry additions, reorders and deletion-versus-edit conflicts preserve stable identities', () => {
  const before = base(), mine = copy(before), theirs = copy(before);
  mine.content.projects.reverse(); theirs.content.projects[0].description = 'Remote edit'; theirs.content.projects.push({ entryId: 'three', title: 'Third project' });
  const plan = tools.mergePlan(before, mine, theirs); assert.equal(plan.conflicts.length, 0);
  const result = tools.resolvePlan(plan, {}); assert.deepEqual(result.content.projects.map((entry) => entry.entryId), ['two', 'one', 'three']); assert.equal(result.content.projects[1].description, 'Remote edit');
  mine.content.projects = mine.content.projects.filter((entry) => entry.entryId !== 'one');
  const deletion = tools.mergePlan(before, mine, theirs); assert.equal(deletion.conflicts.length, 1);
  assert.equal(tools.resolvePlan(deletion, { 0: 'mine' }).content.projects.some((entry) => entry.entryId === 'one'), false);
  assert.equal(tools.resolvePlan(deletion, { 0: 'theirs' }).content.projects.find((entry) => entry.entryId === 'one').description, 'Remote edit');
});
test('Phase 2: selective imports retain unselected contact facts and existing entries, and merge skills', () => {
  const content = base().content; content.skills.technical = ['Python'];
  const incoming = normalizeContent({ contactInfo: { name: 'Different name', phone: '999' }, summary: 'Imported summary', skills: { technical: ['Rust'] }, projects: [{ title: 'New project', description: 'A verified contribution' }] });
  const units = importUnits(content, { content: incoming, issues: [{ path: ['summary'], reason: 'Check wording' }] });
  assert.equal(units.find((unit) => unit.key === 'summary').uncertain, true);
  const selected = units.filter((unit) => ['summary', 'skills-technical'].includes(unit.key) || unit.label.includes('New project')).map((unit) => unit.key);
  const merged = mergeImport(content, units, selected); assert.equal(merged.contactInfo.name, 'Fictional Candidate'); assert.equal(merged.contactInfo.phone, '111'); assert.equal(merged.projects.length, 3); assert.deepEqual(merged.skills.technical, ['Python', 'Rust']); assert.equal(merged.summary, 'Imported summary'); assert.notEqual(merged.projects[2].entryId, incoming.projects[0].entryId);
});
test('Phase 2: duplicate and date feedback covers reversed, invalid, current and month-only dates', () => {
  const content = base().content; content.projects.push({ ...content.projects[0], entryId: 'duplicate' }); assert.equal(tools.duplicateEntries(content).length, 1);
  assert.match(tools.dateIssue({ startDate: '2025', endDate: '2020' }), /before/); assert.match(tools.dateIssue({ startDate: '2024-13' }), /YYYY/); assert.equal(tools.dateIssue({ startDate: 'January 2024', endDate: 'Feb 2024' }), ''); assert.equal(tools.dateIssue({ startDate: '2024', current: true }), '');
});
test('Phase 2: guided student questions add only supplied responsibilities, contribution, tools and outcome', () => {
  const Guided = load('components/ResumeEditor/GuidedQuestions.js').default; let result;
  render(React.createElement(Guided, { content: base().content, level: 'student', onChange: (next) => { result = next; } }));
  fireEvent.click(screen.getByText('Build stronger experience with guided questions'));
  fireEvent.change(screen.getByLabelText('Guided project name'), { target: { value: 'Course importer' } });
  fireEvent.change(screen.getByLabelText('What problem or assignment did the team need to solve?'), { target: { value: 'Validate input files' } });
  fireEvent.change(screen.getByLabelText('What did you personally build, investigate or test?'), { target: { value: 'I wrote the validation rules' } });
  fireEvent.change(screen.getByLabelText('Which tools or methods did you actually use?'), { target: { value: 'Python, Git' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add my verified details to draft' }));
  assert.equal(result.projects.length, 3); assert.deepEqual(result.projects[2].highlights, ['Validate input files', 'I wrote the validation rules']); assert.deepEqual(result.projects[2].technologies, ['Python', 'Git']); assert(!/\d+%/.test(JSON.stringify(result.projects[2])));
});
test('Phase 2: field conflict resolution requires an explicit choice and announces the merged result', () => {
  const Conflict = load('components/DraftToolbar/ConflictResolver.js').default; const before = base(), mine = copy(before), theirs = copy(before); mine.content.summary = 'Mine'; theirs.content.summary = 'Theirs'; let result;
  render(React.createElement(Conflict, { resolution: { plan: tools.mergePlan(before, mine, theirs) }, onResolve: (value) => { result = value; } }));
  assert(screen.getByRole('button', { name: 'Use resolved draft' }).disabled); assert.equal(document.activeElement.textContent, 'Resolve changes field by field');
  fireEvent.click(screen.getByRole('radio', { name: /Keep my change/ })); fireEvent.click(screen.getByRole('button', { name: 'Use resolved draft' })); assert.equal(result.content.summary, 'Mine');
});
test('Phase 2: layouts load saved settings and save with a separate optimistic revision', async () => {
  const Export = load('components/ResumeEditor/ExportPanel.js').default; let sent;
  api.put = async (url, body) => { sent = { url, body }; return respond({ layoutRevision: 4, exportSettings: body.settings }); };
  render(React.createElement(Export, { version: { _id: 'version', resumeId: 'resume', version: 1, contentRevision: 2, layoutRevision: 3, exportSettings: { template: 'modern', font: 'serif', pageBreakBefore: ['education'] } } }));
  assert.equal(screen.getByRole('combobox', { name: 'Template' }).value, 'modern'); assert(screen.getByRole('checkbox', { name: 'Education' }).checked);
  fireEvent.change(screen.getByRole('combobox', { name: 'Margins' }), { target: { value: '56' } }); fireEvent.click(screen.getByRole('button', { name: 'Save layout for this version' }));
  await waitFor(() => assert(screen.getByText('Layout preferences saved for this version.'))); assert.equal(sent.body.revision, 3); assert.equal(sent.body.settings.margin, 56); assert.equal(sent.body.settings.font, 'serif');
});
test('Phase 2: editing a different field keeps accepted and rejected AI decisions', async () => {
  const Review = load('components/ResumeEditor/ReviewEditor.js').default, source = base().content, target = copy(source); target.summary = 'Tailored summary'; target.projects[0].description = 'Tailored contribution';
  const version = { _id: 'v1', resumeId: 'r1', version: 1, targetRole: 'Engineer', sourceContent: source, tailoredContent: target, reviewDecisions: { summary: 'accepted', r_projects_one_description: 'rejected' }, contentRevision: 1 };
  let sent; api.put = async (_url, body) => { sent = body; return respond({ ...version, reviewedContent: body.content, reviewDecisions: body.decisions, contentRevision: 2 }); };
  render(React.createElement(Review, { version })); await screen.findByLabelText('Phone'); fireEvent.change(screen.getByLabelText('Phone'), { target: { value: '333' } }); fireEvent.click(screen.getByRole('button', { name: 'Save now' }));
  await waitFor(() => assert(sent)); assert.equal(sent.decisions.summary, 'accepted'); assert.equal(sent.decisions.r_projects_one_description, 'rejected'); assert.equal(sent.content.contactInfo.phone, '333');
});
