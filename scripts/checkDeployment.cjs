const requiredOperations = [
  ['get', '/evidence'], ['post', '/evidence/imports/document'], ['post', '/evidence/imports/{id}/confirm'],
  ['post', '/evidence/copilot'], ['post', '/evidence/copilot/{id}/answers'], ['get', '/resumes/{id}/versions/{versionId}/evidence'],
];
function address(value) {
  let url; try { url = new URL(value); } catch { throw new Error('Provide valid --api and --frontend URLs.'); }
  if (url.username || url.password || url.search || url.hash || !['https:', 'http:'].includes(url.protocol) || url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('Use credential-free HTTPS deployment URLs, or HTTP localhost URLs for local tests.');
  return url.href.replace(/\/+$/, '');
}
async function response(url, timeoutMs) {
  const result = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), redirect: 'error' });
  let bytes = 0; const chunks = [];
  for await (const chunk of result.body) { bytes += chunk.length; if (bytes > 2 * 1024 * 1024) throw new Error('Response exceeded the deployment probe limit.'); chunks.push(chunk); }
  let json; try { json = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { /* Frontend pages contain HTML. */ }
  return { status: result.status, json };
}
async function checkDeployment({ apiUrl, frontendUrl, timeoutMs = 60000 }) {
  const api = address(apiUrl), frontend = address(frontendUrl), checks = [];
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 120000) throw new Error('Timeout must be 100 to 120000 milliseconds.');
  async function check(name, url, valid) {
    try { const result = await response(url, timeoutMs); checks.push({ name, url, status: result.status, passed: valid(result) }); }
    catch (error) { checks.push({ name, url, passed: false, error: error.name === 'TimeoutError' ? 'Request timed out' : 'Endpoint could not be read safely' }); }
  }
  await check('API database and worker readiness', api + '/health', (result) => result.status === 200 && result.json?.status === 'healthy' && result.json?.database?.status === 'connected' && result.json?.queue?.workerReady === true);
  await check('Phase 3 API contract', api + '/openapi.json', (result) => result.status === 200 && /^3\./.test(result.json?.openapi || '') && requiredOperations.every(([method, path]) => result.json.paths?.[path]?.[method]));
  for (const path of ['/evidence', '/evidence/copilot']) await check('Protected Phase 3 route ' + path, api + path, (result) => result.status === 401 && result.json?.code === 'SESSION_REQUIRED');
  for (const path of ['', '/evidence', '/copilot']) await check('Frontend route ' + (path || '/'), frontend + path, (result) => result.status === 200);
  return { passed: checks.every((item) => item.passed), checks, scope: 'Read-only public readiness checks. Does not log in, send mail or prove private hosting configuration.' };
}
if (require.main === module) {
  (async () => {
    const values = {};
    for (const arg of process.argv.slice(2)) { const match = arg.match(/^--(api|frontend|timeout)=(.+)$/); if (!match || values[match[1]]) throw new Error('Usage: node scripts/checkDeployment.cjs --api=https://backend/api --frontend=https://frontend'); values[match[1]] = match[2]; }
    const report = await checkDeployment({ apiUrl: values.api, frontendUrl: values.frontend, ...(values.timeout ? { timeoutMs: Number(values.timeout) } : {}) }); console.log(JSON.stringify(report, null, 2)); if (!report.passed) process.exitCode = 1;
  })().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
module.exports = { checkDeployment };
