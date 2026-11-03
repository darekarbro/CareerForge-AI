const { test, beforeEach, afterEach } = require('node:test'), assert = require('node:assert/strict');
const h = require('./helpers.cjs'), { React, load, render, screen, fireEvent, waitFor, respond, api, act } = h;
beforeEach(() => { h.reset(); h.session('A'); }); afterEach(() => { h.cleanup(); h.auth.getState().logout(false); });
function resources() { api.get = async (url) => { if (url === '/resumes') return respond([{ _id: 'r1', title: 'Verified source', processingStatus: 'COMPLETED', verifiedAt: '2026-11-03' }]); if (url === '/evidence/copilot' || url === '/notifications' || url.endsWith('/timeline')) return respond([]); throw new Error('Unexpected GET ' + url); }; }

test('Phase 3 readiness: leaving the copilot stops waiting without redirecting or cancelling its background job', async () => {
  resources(); const page = load('pages/copilot.js').default, navigations = [], requests = []; let release, signal;
  const push = h.router.push; h.router.push = async (url) => navigations.push(url);
  api.post = (url, _body, options) => { requests.push(url); signal = options.signal; return new Promise((resolve) => { release = resolve; }); };
  try {
    const view = render(React.createElement(page)); await screen.findByRole('option', { name: /Verified source/ }); fireEvent.change(screen.getByLabelText('Copilot source resume'), { target: { value: 'r1' } }); fireEvent.click(screen.getByRole('button', { name: 'Plan an evidence-backed draft' }));
    await waitFor(() => assert.equal(typeof release, 'function')); view.unmount(); assert.equal(signal.aborted, true);
    await act(async () => release(respond({ copilotRun: { _id: 'run1', status: 'draft_ready', sourceRevision: 1, targetRole: 'Engineer' } })));
    assert.deepEqual(navigations, []); assert.deepEqual(requests, ['/evidence/copilot']);
  } finally { h.router.push = push; }
});

test('Phase 3 readiness: saved interrupted imports remain recoverable after reloading the library', async () => {
  const Import = load('components/Evidence/EvidenceImport.js').default, calls = []; let completed = 0;
  api.post = async (url, body) => { calls.push({ url, body }); return respond({}); };
  render(React.createElement(Import, { contexts: [], pendingImports: [{ _id: 'saved', title: 'Course importer', revision: 2 }], onImported: async () => completed++ }));
  fireEvent.click(screen.getByRole('button', { name: 'Finish import: Course importer' })); await waitFor(() => assert.equal(completed, 1));
  assert.deepEqual(calls, [{ url: '/evidence/imports/saved/confirm', body: { revision: 2, confirmFacts: true, retry: true } }]);
});

test('Phase 3 readiness: failed copilot jobs are labelled failed in their result and history', async () => {
  resources(); h.router.query = { run: 'failed-run' }; const page = load('pages/copilot.js').default, get = api.get;
  const run = { _id: 'failed-run', resumeId: 'r1', targetRole: 'Engineer', status: 'planning', jobStatus: 'FAILED', jobError: 'Synthetic outage', sourceRevision: 1, jobId: 'j1', trace: [], retrieval: [], createdAt: '2026-11-03' };
  api.get = async (url) => url === '/evidence/copilot/failed-run' ? respond(run) : url === '/evidence/copilot' ? respond([run]) : get(url);
  render(React.createElement(page)); await screen.findByRole('heading', { name: 'Copilot result: failed' }); assert(screen.getByText(/The background request failed/)); assert(screen.getByRole('link', { name: /Engineer · failed/ }));
});
