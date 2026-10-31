const { test, beforeEach, afterEach } = require('node:test'), assert = require('node:assert/strict');
const h = require('./helpers.cjs'), { React, load, render, screen, fireEvent, waitFor, api, respond } = h;
beforeEach(() => { h.reset(); h.session('A'); }); afterEach(() => { h.cleanup(); h.auth.getState().logout(false); });
test('Phase 3: evidence contexts retain entry identity while separating source records', () => {
  const { evidenceContexts } = load('services/evidenceTools.js');
  const resumes = [{ _id: 'r1', title: 'One', parsedData: { projects: [{ entryId: 'stable-project', title: 'Importer' }] } }, { _id: 'r2', title: 'Two', parsedData: { projects: [{ entryId: 'stable-project', title: 'Importer' }] } }];
  const contexts = evidenceContexts(resumes); assert.equal(contexts.length, 2); assert.deepEqual(contexts[0].context, { section: 'projects', entryId: 'stable-project', recordId: 'r1' }); assert.notEqual(contexts[0].value, contexts[1].value);
});
test('Phase 3: evidence form preserves typed technology separators and leaves unknown measurements empty', () => {
  const Form = load('components/Evidence/EvidenceForm.js').default; let sent;
  render(React.createElement(Form, { contexts: [], onSave: (value) => { sent = value; } }));
  fireEvent.change(screen.getByLabelText('Evidence title'), { target: { value: 'Input validation' } }); fireEvent.change(screen.getByLabelText('What can you substantiate?'), { target: { value: 'I wrote validation rules for malformed course input.' } });
  fireEvent.change(screen.getByLabelText('Technologies used in this fact'), { target: { value: 'Python,' } }); assert.equal(screen.getByLabelText('Technologies used in this fact').value, 'Python,');
  fireEvent.change(screen.getByLabelText('Technologies used in this fact'), { target: { value: 'Python, Rust' } }); fireEvent.submit(screen.getByRole('form', { name: 'Career evidence form' }));
  assert.deepEqual(sent.technologies, ['Python', 'Rust']); assert.equal(sent.measurement, 'unknown'); assert.equal(sent.measurementNotes, ''); assert.equal(sent.verification, 'unverified');
  fireEvent.change(screen.getByLabelText('Outcome measurement'), { target: { value: 'measured' } }); assert.equal(screen.getByLabelText('How was the result measured?').required, true);
});
test('Phase 3: project import previews are selective and require ownership and contribution confirmation', async () => {
  const Import = load('components/Evidence/EvidenceImport.js').default; const requests = []; let imported = false;
  api.post = async (url, body) => { requests.push({ url, body }); return respond(url.endsWith('/github') ? { _id: 'source1', revision: 1, title: 'fictional/project', text: 'A Python course importer.', metadata: { note: 'Public README is not proof of contribution.' }, candidates: [{ id: 'line1', line: 1, title: 'Importer', kind: 'project', statement: 'A Python course importer.', quote: 'A Python course importer.', technologies: ['Python'], warning: 'Confirm personal contribution.' }] } : { items: [] }); };
  render(React.createElement(Import, { contexts: [], onImported: async () => { imported = true; } })); fireEvent.click(screen.getByText('Import a project from GitHub or a document'));
  fireEvent.change(screen.getByLabelText('Public GitHub repository URL'), { target: { value: 'https://github.com/fictional/project' } }); assert(screen.getByRole('button', { name: 'Preview GitHub project' }).disabled);
  fireEvent.click(screen.getByRole('checkbox', { name: /This is my repository/ })); fireEvent.click(screen.getByRole('button', { name: 'Preview GitHub project' })); await screen.findByRole('heading', { name: 'Preview: fictional/project' });
  assert.equal(requests.length, 1); assert(screen.getByRole('button', { name: 'Import confirmed project facts' }).disabled);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Import source line 1' })); fireEvent.change(screen.getByLabelText('My confirmed contribution from line 1'), { target: { value: 'I implemented the Python input validation.' } });
  fireEvent.click(screen.getByRole('checkbox', { name: /I have checked these selected statements/ })); fireEvent.click(screen.getByRole('button', { name: 'Import confirmed project facts' }));
  await waitFor(() => assert(imported)); assert.equal(requests[1].body.confirmFacts, true); assert.equal(requests[1].body.items.length, 1); assert.equal(requests[1].body.items[0].statement, 'I implemented the Python input validation.');
});
test('Phase 3: claim evidence exposes source quotes, confirmation states and withheld suggestions', async () => {
  const Panel = load('components/Evidence/ClaimEvidencePanel.js').default;
  api.get = async () => respond({ summary: { cited: 1, total: 1, needsReview: 0 }, historical: 1, legacy: false, claims: [{ path: ['projects', 0, 'description'], label: 'Importer contribution', status: 'withheld', text: 'Built Python validation.', withheldText: 'Led 25 Kubernetes developers.', explanation: 'Unsupported wording was withheld.', issues: ['Kubernetes is not supported by this entry.'], citations: [{ evidenceId: 'e1', revision: 1, title: 'Verified importer', quote: 'Built Python validation.', verification: 'confirmed', measurement: 'unknown', source: {} }] }] });
  render(React.createElement(Panel, { version: { _id: 'v1', resumeId: 'r1', contentRevision: 1 } })); fireEvent.click(screen.getByText('Evidence behind this resume'));
  await screen.findByText(/1 of 1 current statements have citations/); fireEvent.click(screen.getByText(/Importer contribution · Withheld/)); assert(screen.getByText('Led 25 Kubernetes developers.')); assert.equal(screen.getByRole('link', { name: 'Verified importer' }).getAttribute('href'), '/evidence?evidence=e1'); assert(screen.getByText('Confirmed by you · Evidence revision 1 · Measurement: unknown'));
});
test('Phase 3: copilot clarification preserves blank outcomes and opens a reviewable draft', async () => {
  const Copilot = load('pages/copilot.js').default, originalGet = api.get, requests = [];
  const run = { _id: 'run1', resumeId: 'r1', revision: 2, sourceRevision: 1, targetRole: 'Backend Engineer', status: 'needs_input', trace: [{ action: 'clarify', reason: 'Need personal contribution' }], retrieval: [], questions: [{ id: 'contribution', prompt: 'What did you personally implement?', required: true }, { id: 'outcome', prompt: 'What outcome can you verify?', required: false }] };
  const complete = { ...run, status: 'draft_ready', versionId: 'v1', revision: 3 };
  api.get = async (url) => {
    if (url === '/resumes') return respond([{ _id: 'r1', title: 'Verified source', processingStatus: 'COMPLETED', verifiedAt: '2026-10-31' }]); if (url === '/evidence/copilot') return respond([]);
    if (url.endsWith('/timeline')) return respond([]); if (url.startsWith('/processing-jobs/')) return respond({ _id: url.endsWith('job1') ? 'job1' : 'job2', status: 'COMPLETED', output: { copilotRun: url.endsWith('job1') ? run : complete } }); return originalGet(url);
  };
  api.post = async (url, body) => { requests.push({ url, body }); return { status: 202, data: { data: { jobId: requests.length === 1 ? 'job1' : 'job2' } } }; };
  render(React.createElement(Copilot)); await screen.findByRole('option', { name: /Verified source/ }); fireEvent.change(screen.getByLabelText('Copilot source resume'), { target: { value: 'r1' } }); fireEvent.click(screen.getByRole('button', { name: 'Plan an evidence-backed draft' }));
  await screen.findByRole('heading', { name: 'Clarify your contribution' }); fireEvent.change(screen.getByLabelText('What did you personally implement?'), { target: { value: 'I wrote validation and tested error recovery.' } });
  assert(screen.getByRole('button', { name: 'Continue with confirmed facts' }).disabled); fireEvent.click(screen.getByRole('checkbox', { name: /I confirm that any answers/ })); fireEvent.click(screen.getByRole('button', { name: 'Continue with confirmed facts' }));
  await screen.findByRole('link', { name: 'Review draft and its evidence' }); assert.deepEqual(requests[1].body.answers.find((answer) => answer.questionId === 'outcome'), { questionId: 'outcome', text: '' }); assert.equal(requests[1].body.revision, 2);
});
test('Phase 3: Activity opens the copilot decision record even when a draft exists', () => {
  const { resultLink } = load('pages/activity.js'); assert.equal(resultLink({ jobType: 'resume_copilot', inputRef: { copilotId: 'run1', resumeId: 'r1' }, output: { tailoredResume: { _id: 'v1' } } }), '/copilot?run=run1');
});

test('Phase 3: reopening an active copilot run follows its persisted job through completion', async () => {
  h.router.query = { run: 'run1' };
  const Copilot = load('pages/copilot.js').default;
  const run = { _id: 'run1', resumeId: 'r1', jobId: 'job1', revision: 1, sourceRevision: 1, targetRole: 'Engineer', status: 'planning', jobStatus: 'RUNNING', trace: [], retrieval: [] };
  api.get = async (url) => {
    if (url === '/resumes' || url === '/evidence/copilot' || url.endsWith('/timeline')) return respond([]);
    if (url === '/evidence/copilot/run1') return respond(run);
    if (url === '/processing-jobs/job1') return respond({ _id: 'job1', status: 'COMPLETED', output: { copilotRun: { ...run, status: 'draft_ready', versionId: 'v1' } } });
    if (url === '/notifications') return respond([]); throw new Error('Unexpected GET ' + url);
  };
  render(React.createElement(Copilot)); await screen.findByRole('link', { name: 'Review draft and its evidence' });
  assert.equal(screen.getByRole('link', { name: 'Review draft and its evidence' }).getAttribute('href'), '/resume/r1/tailor?version=v1');
});
