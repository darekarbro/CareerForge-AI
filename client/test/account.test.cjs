const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { React, load, api, auth, respond, session, reset, render, screen, fireEvent, waitFor, cleanup } = require('./helpers.cjs');
beforeEach(reset); afterEach(() => { cleanup(); auth.getState().logout(false); });
test('Phase 1: recovery uses a generic response and never sends a password', async () => {
  const Form = load('components/Account/AccountLinkForm.js').default; let sent;
  api.post = async (url, body) => { sent = { url, body }; return respond({ message: 'If eligible, check your inbox.' }); };
  render(React.createElement(Form, { mode: 'forgot' }));
  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'fictional@example.test' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send recovery link' }));
  await screen.findByRole('status'); assert.deepEqual(sent, { url: '/auth/forgot-password', body: { email: 'fictional@example.test' } });
});
test('Phase 1: reset checks password confirmation before submitting the fragment token', async () => {
  window.history.replaceState(null, '', '/reset-password#token=' + 'a'.repeat(64));
  const Form = load('components/Account/AccountLinkForm.js').default; let sent;
  api.post = async (url, body) => { sent = { url, body }; return respond({ reset: true }); };
  render(React.createElement(Form, { mode: 'reset' }));
  fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'fictional-new-password' } });
  fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'different-password' } });
  fireEvent.click(screen.getByRole('button', { name: 'Reset password' })); await screen.findByRole('alert'); assert.equal(sent, undefined);
  fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'fictional-new-password' } });
  fireEvent.click(screen.getByRole('button', { name: 'Reset password' })); await screen.findByRole('status');
  assert.equal(sent.body.token, 'a'.repeat(64)); assert.equal(window.location.hash, ''); assert.equal(auth.getState().isAuthenticated, false);
});
test('Phase 1: privacy controls save explicit provider choices and deletion requires exact confirmation', async () => {
  session(); auth.getState().updateUser({ ...auth.getState().user, authProvider: 'local', emailVerifiedAt: new Date().toISOString() });
  const settings = { providers: { groq: false, openrouter: false, gemini: false }, activityDays: 90, cacheDays: 7, retryInputHours: 24 };
  const get = api.get; api.get = async (url) => url === '/privacy' ? respond(settings) : url === '/auth/sessions' ? respond([]) : get(url);
  let saved; api.put = async (url, body) => { saved = { url, body }; return respond(body); };
  render(React.createElement(load('pages/account.js').default));
  const groq = await screen.findByRole('checkbox', { name: 'Groq', exact: true }); assert.equal(groq.checked, false); fireEvent.click(groq);
  fireEvent.click(screen.getByRole('button', { name: 'Save privacy preferences' })); await waitFor(() => assert.equal(saved?.body.providers.groq, true)); assert.equal(saved.url, '/privacy');
  const remove = screen.getByRole('button', { name: 'Delete my account' }); assert.equal(remove.disabled, true);
  fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'fictional-password' } });
  fireEvent.change(screen.getByLabelText('Type DELETE to confirm'), { target: { value: 'delete' } }); assert.equal(remove.disabled, true);
  fireEvent.change(screen.getByLabelText('Type DELETE to confirm'), { target: { value: 'DELETE' } }); assert.equal(remove.disabled, false);
});
