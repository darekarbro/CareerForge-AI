const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { React, load, api, auth, router, respond, session, reset, render, screen, fireEvent, waitFor, cleanup, act } = require('./helpers.cjs');
const element = React.createElement;
beforeEach(reset); afterEach(() => { cleanup(); auth.getState().logout(); });
function Harness({ revision = 1, text = 'Saved' }) {
  const useDraft = load('hooks/usePersistentDraft.js').default, useSync = load('hooks/useDraftSync.js').default;
  const userId = auth((state) => state.user?.id), [server, setServer] = React.useState({ userId, revision, value: { text } });
  const draft = useDraft('test-editor', server), sync = useSync(draft, '/test-editor', (record) => ({ revision: record.revision, value: { text: record.text } }), setServer);
  if (!draft.ready) return element('p', null, 'Loading');
  return element('div', null, element('input', { 'aria-label': 'Draft text', value: draft.value.text, onChange: (event) => sync.change({ text: event.target.value }) }),
    element('button', { onClick: sync.save, disabled: sync.saving }, 'Save'), element('button', { onClick: draft.undo }, 'Undo'), element('button', { onClick: draft.redo }, 'Redo'),
    element('output', null, String(draft.baseRevision)), sync.error && element('p', { role: 'alert' }, sync.error), draft.conflict && element('p', null, 'Conflict'));
}
test('Draft sync preserves edits made during a save and uses the returned revision for the next save', async () => {
  session('A'); let release; const calls = [];
  api.put = async (_url, body) => { calls.push(body); return new Promise((resolve) => { release = () => resolve(respond({ ...body, revision: body.revision + 1 })); }); };
  render(element(Harness));
  const input = await screen.findByLabelText('Draft text');
  fireEvent.change(input, { target: { value: 'First edit' } }); fireEvent.click(screen.getByText('Save'));
  fireEvent.change(input, { target: { value: 'Second edit during request' } });
  await act(async () => release());
  assert.equal(input.value, 'Second edit during request'); assert.equal(screen.getByRole('status').textContent, '2');
  fireEvent.click(screen.getByText('Save')); assert.equal(calls[1].revision, 2); assert.equal(calls[1].text, 'Second edit during request');
  await act(async () => release());
});
test('Local drafts survive a remount, flag server conflicts and are cleared on logout', async () => {
  session('A');
  let view = render(element(Harness));
  fireEvent.change(await screen.findByLabelText('Draft text'), { target: { value: 'Private draft A' } });
  view.unmount(); view = render(element(Harness, { revision: 2 }));
  assert.equal((await screen.findByLabelText('Draft text')).value, 'Private draft A'); assert(screen.getByText('Conflict'));
  view.unmount(); auth.getState().logout(); session('B'); render(element(Harness));
  assert.equal((await screen.findByLabelText('Draft text')).value, 'Saved');
  assert(![...Array(localStorage.length)].some((_item, index) => localStorage.getItem(localStorage.key(index)).includes('Private draft A')));
});
test('Individual AI changes can be rejected, undone and saved without losing other resume sections', async () => {
  session('A'); const Editor = load('components/ResumeEditor/ReviewEditor.js').default;
  const source = { contactInfo: { name: 'Candidate' }, summary: 'Existing summary', skills: { all: ['Python'], technical: ['Python'] },
    workExperience: [{ role: 'Engineer', company: 'Source Co', highlights: ['Original Python work'] }], projects: [], education: [{ institution: 'Real University' }], certifications: [{ name: 'Real certificate' }] };
  const version = { _id: 'v1', resumeId: 'r1', version: 1, contentRevision: 1, sourceContent: source, tailoredContent: { ...source, workExperience: [{ ...source.workExperience[0], highlights: ['Rewritten Python work'] }] } };
  let saved;
  api.put = async (_url, body) => { saved = body; return respond({ ...version, contentRevision: 2, reviewedContent: body.content, reviewDecisions: body.decisions }); };
  render(element(Editor, { version }));
  fireEvent.click(await screen.findByRole('button', { name: 'Keep original' }));
  assert(screen.getByRole('button', { name: 'Download PDF', exact: true }).disabled);
  fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
  fireEvent.click(screen.getByRole('button', { name: 'Redo' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save now' }));
  await waitFor(() => assert(saved));
  assert.equal(saved.content.workExperience[0].highlights[0], 'Original Python work');
  assert.equal(saved.content.certifications[0].name, 'Real certificate'); assert.equal(saved.content.education[0].institution, 'Real University');
  assert(Object.values(saved.decisions).includes('rejected'));
});
test('Dashboard errors show a retry state without invented personal metrics', async () => {
  session('A'); const Page = load('pages/dashboard.js').default;
  api.get = async (url) => { if (url === '/notifications') return respond([]); throw new Error('offline'); };
  render(element(Page));
  await screen.findByRole('alert'); assert(screen.getByRole('button', { name: 'Retry' }));
  assert(!screen.queryByText('65%')); assert(!screen.queryByText('Needs Optimization')); assert(!screen.queryByText('No resumes uploaded yet.'));
});
test('A workspace-prefilled application editor stays closed after saving and filtering the board', async () => {
  session('A'); router.query = { workspace: 'w1' }; router.pathname = '/applications';
  const Page = load('pages/applications.js').default; let stored = [];
  api.get = async (url) => {
    if (url === '/notifications') return respond([]);
    if (url.startsWith('/applications?')) return respond(stored);
    if (url === '/applications/analytics') return respond({ totalApplications: stored.length, stages: { interview: 0, offer: 0 }, weeklyVolume: [] });
    if (url === '/workspaces/w1') return respond({ workspace: { _id: 'w1', company: 'Workspace Co', title: 'Engineer' }, application: null });
    if (url === '/workspaces' || url === '/applications/resume-versions') return respond([]);
    throw new Error(url);
  };
  api.post = async (_url, body) => { stored = [{ ...body, _id: 'a1', revision: 1, createdAt: new Date().toISOString() }]; return respond(stored[0]); };
  render(element(Page)); await screen.findByRole('dialog');
  fireEvent.click(screen.getByRole('button', { name: 'Save Application', exact: true }));
  await waitFor(() => assert(!screen.queryByRole('dialog')));
  fireEvent.change(screen.getByLabelText('Search company or role'), { target: { value: 'Workspace' } });
  await screen.findByRole('button', { name: 'Edit Engineer at Workspace Co', exact: true });
  assert(!screen.queryByRole('dialog'));
});
