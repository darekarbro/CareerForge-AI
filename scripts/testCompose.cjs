// Exercises only a newly created fictional account. Leaves existing accounts and volumes intact.
const assert = require('node:assert/strict'), { spawnSync } = require('node:child_process'), path = require('node:path');
const api = process.env.COMPOSE_API_URL || 'http://localhost:5000/api', inbox = process.env.COMPOSE_MAIL_URL || 'http://localhost:8025';
const email = 'compose-' + Date.now() + '@example.test', password = 'fictional-compose-password';
let token, socket;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function request(method, route, body, expected = 200) {
  const multipart = body instanceof FormData;
  const res = await fetch(api + route, { method, headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(!multipart && body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: multipart ? body : JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000) });
  const data = res.headers.get('content-type')?.includes('application/json') ? await res.json() : Buffer.from(await res.arrayBuffer());
  assert.equal(res.status, expected, method + ' ' + route + ': ' + (Buffer.isBuffer(data) ? 'binary response' : JSON.stringify(data))); return data;
}
async function until(work, timeout = 90000) { const end = Date.now() + timeout; while (Date.now() < end) { const value = await work(); if (value) return value; await pause(500); } throw new Error('Timed out waiting for container workflow'); }
async function messageToken(subject) {
  return until(async () => {
    const listing = await (await fetch(inbox + '/api/v1/messages')).json();
    const message = listing.messages?.find((item) => item.Subject.startsWith(subject) && item.To?.some((to) => to.Address === email));
    if (!message) return null;
    const detail = await (await fetch(inbox + '/api/v1/message/' + message.ID)).json();
    return detail.Text?.match(/#token=([a-f0-9]{64})/)?.[1];
  });
}
function compose(...args) {
  const docker = process.env.DOCKER_BIN || (process.platform === 'win32' ? path.join(process.env.LOCALAPPDATA, 'Programs/DockerDesktop/resources/bin/docker.exe') : 'docker');
  const result = spawnSync(docker, ['compose', '--env-file', '.env.compose', ...args], { cwd: path.resolve(__dirname, '..'), windowsHide: true, encoding: 'utf8', timeout: 90000 });
  if (result.status !== 0) throw new Error('Container action failed: ' + args.join(' ') + '\n' + (result.stderr || result.error?.message || ''));
}
async function finished(id) {
  return until(async () => { const job = (await request('GET', '/processing-jobs/' + id)).data; if (job.status === 'FAILED' || job.status === 'CANCELLED') throw new Error(JSON.stringify(job.error)); return job.status === 'COMPLETED' ? job : null; });
}
(async () => {
  try {
    await until(async () => { try { return (await fetch(api + '/health')).ok; } catch { return false; } });
    assert((await fetch('http://localhost:3000/login')).ok);
    const account = (await request('POST', '/auth/register', { name: 'Container Candidate', email, password }, 201)).data; token = account.token;
    await request('POST', '/auth/verify-email', { token: await messageToken('Verify') });
    let events = 0;
    socket = new WebSocket(api.replace(/^http/, 'ws').replace(/\/api\/?$/, '') + '/socket.io/?EIO=4&transport=websocket');
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Socket handshake timed out')), 10000);
      socket.addEventListener('error', reject);
      socket.addEventListener('message', (event) => {
        const message = String(event.data);
        if (message.startsWith('0')) socket.send('40' + JSON.stringify({ token }));
        if (message === '2') socket.send('3');
        if (message.startsWith('40')) { clearTimeout(timer); resolve(); }
        if (message.startsWith('42') && message.includes('agent_event')) events++;
      });
    });
    const form = new FormData(); form.append('file', new Blob(['Container Candidate\nEmail: ' + email + '\nSummary\nBuilt Python services with tested validation.\nSkills\nPython, React, Git']), 'container-resume.txt');
    const uploaded = (await request('POST', '/resumes/upload', form, 202)).data;
    await finished(uploaded.jobId); assert(events > 0, 'Separate worker must publish socket events through Redis');
    console.log('PASS Separate worker, SMTP verification, private upload and Redis socket events');
    await require('./testComposePhase2.cjs')({ request, finished, resumeId: uploaded.resume._id });
    compose('stop', 'worker');
    const pending = (await request('POST', '/resumes/' + uploaded.resume._id + '/assess', {}, 202)).data;
    await pause(400); assert.equal((await request('GET', '/processing-jobs/' + pending.jobId)).data.status, 'PENDING');
    compose('start', 'worker'); await finished(pending.jobId);
    compose('restart', 'api'); await until(async () => { try { return (await fetch(api + '/health')).ok; } catch { return false; } });
    assert.equal((await request('GET', '/resumes/' + uploaded.resume._id)).data.originalFileName, 'container-resume.txt');
    const original = await request('GET', '/resumes/' + uploaded.resume._id + '/original'); assert(original.includes(Buffer.from('Container Candidate')));
    console.log('PASS API queues without executing while worker is stopped; database, sessions and originals survive restart');
    compose('stop', 'redis');
    try {
      await pause(1000);
      const recovered = (await request('POST', '/resumes/' + uploaded.resume._id + '/assess', {}, 202)).data;
      await finished(recovered.jobId);
      console.log('PASS Redis outage preserves API availability and MongoDB worker recovery');
    } finally { compose('start', 'redis'); }
    await until(async () => (await (await fetch(api + '/health')).json()).queue.mode === 'BullMQ (Redis)');
    await request('POST', '/auth/forgot-password', { email });
    await request('POST', '/auth/reset-password', { token: await messageToken('Reset'), password: 'replacement-compose-password' });
    await request('GET', '/auth/me', undefined, 401);
    token = (await request('POST', '/auth/login', { email, password: 'replacement-compose-password' })).data.token;
    const archive = await request('POST', '/privacy/export', { password: 'replacement-compose-password' }); assert.equal(archive.subarray(0, 2).toString(), 'PK');
    const deletion = (await request('POST', '/privacy/delete', { password: 'replacement-compose-password', confirmation: 'DELETE' }, 202)).data;
    token = undefined;
    await until(async () => (await request('POST', '/privacy/deletion-status', { receipt: deletion.receipt })).data.status === 'completed');
    console.log('PASS SMTP password recovery, session revocation, original-file archive and complete background account deletion');
  } finally { socket?.close(); }
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
