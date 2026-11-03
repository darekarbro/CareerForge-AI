const { test } = require('node:test'), assert = require('node:assert/strict'), http = require('node:http');
const { checkDeployment } = require('../../scripts/checkDeployment.cjs'), specification = require('../src/openapi');
async function service(t, { old = false, worker = true, open = false, missingFrontend = false } = {}) {
  const server = http.createServer((req, res) => {
    if (req.url === '/api/health') { res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify({ status: 'healthy', database: { status: 'connected' }, queue: { workerReady: worker } })); }
    if (req.url === '/api/openapi.json' && !old) { res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify(specification)); }
    if (req.url.startsWith('/api/')) { res.statusCode = old ? 404 : open ? 200 : 401; res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify({ code: 'SESSION_REQUIRED' })); }
    res.statusCode = missingFrontend && req.url === '/copilot' ? 404 : 200; res.end('<html><body>Fictional frontend</body></html>');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve)); t.after(() => new Promise((resolve) => server.close(resolve))); const base = 'http://127.0.0.1:' + server.address().port;
  return { apiUrl: base + '/api', frontendUrl: base, timeoutMs: 5000 };
}
test('Phase 3 readiness: deployment preflight accepts the current protected API and available frontend', async (t) => { assert.equal((await checkDeployment(await service(t))).passed, true); });
test('Phase 3 readiness: a healthy old API, absent worker and unprotected or missing routes cannot pass preflight', async (t) => {
  for (const configuration of [{ old: true }, { worker: false }, { open: true }, { missingFrontend: true }]) assert.equal((await checkDeployment(await service(t, configuration))).passed, false);
});
test('Phase 3 readiness: deployment probe rejects credentials and remote plaintext URLs without sending them', async () => {
  await assert.rejects(checkDeployment({ apiUrl: 'https://user:fictional-secret@example.test/api', frontendUrl: 'https://example.test' }), (error) => !error.message.includes('fictional-secret'));
  await assert.rejects(checkDeployment({ apiUrl: 'http://example.test/api', frontendUrl: 'https://example.test' }), /HTTPS/);
});
