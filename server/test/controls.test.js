const test = require('node:test'), assert = require('node:assert/strict');
const http = require('node:http'), path = require('node:path');
const { execFile } = require('node:child_process'), { promisify } = require('node:util');
const { createLimiters } = require('../src/middlewares/rateLimits');
const { createShutdown } = require('../src/services/shutdown');

test('46: the real Firebase exchange route is protected by the auth rate limiter', async () => {
  const script = 'const server=require("http").createServer(require("./src/app")); server.listen(0,"127.0.0.1",async()=>{try{const statuses=[];for(let i=0;i<3;i++){const r=await fetch("http://127.0.0.1:"+server.address().port+"/api/auth/firebase",{method:"POST",headers:{"Content-Type":"application/json","Connection":"close"},body:"{}"});statuses.push(r.status);await r.text();}console.log(JSON.stringify(statuses));}finally{server.close();}});';
  const { stdout } = await promisify(execFile)(process.execPath, ['--require', './test/setup.cjs', '-e', script], {
    cwd: path.resolve(__dirname, '..'), env: { ...process.env, AUTH_RATE_LIMIT_MAX: '2' }, timeout: 15000,
  });
  assert.deepEqual(JSON.parse(stdout.trim().split('\n').at(-1)), [400, 400, 429]);
});
test('46: generation quotas are per account, including accounts behind the same IP', async () => {
  const express = require('express'), app = express(), { aiLimiter } = createLimiters({ aiMax: 1 });
  app.post('/generate', (req, _res, next) => { req.user = { _id: req.headers['x-test-user'] }; next(); },
    aiLimiter, (_req, res) => res.json({ success: true }));
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const send = async (user) => {
      const response = await fetch('http://127.0.0.1:' + server.address().port + '/generate',
        { method: 'POST', headers: { 'x-test-user': user, Connection: 'close' } });
      await response.text(); return response.status;
    };
    assert.equal(await send('A'), 200); assert.equal(await send('A'), 429); assert.equal(await send('B'), 200);
  } finally { await new Promise((resolve) => server.close(resolve)); }
});
test('48: shutdown closes a connected WebSocket and drains workers/database exactly once', async () => {
  const { Server } = require('socket.io'), { io: connect } = require('socket.io-client');
  const server = http.createServer(), sockets = new Server(server), calls = [];
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const client = connect('http://127.0.0.1:' + server.address().port, { transports: ['websocket'], reconnection: false });
  try {
    await new Promise((resolve, reject) => { client.once('connect', resolve); client.once('connect_error', reject); });
    const shutdown = createShutdown({ server,
      closeSockets: async () => { calls.push('sockets'); await new Promise((resolve) => sockets.close(resolve)); },
      closeWorkers: async () => { calls.push('workers'); },
      disconnectDatabase: async () => { calls.push('database'); }, timeoutMs: 2000,
    });
    const first = shutdown(); assert.equal(shutdown(), first); await first;
    assert.deepEqual(calls, ['sockets', 'workers', 'database']); assert.equal(server.listening, false);
  } finally { client.disconnect(); await new Promise((resolve) => sockets.close(resolve)); }
});
test('48: shutdown enforces a deadline when a dependency cannot drain', async () => {
  const server = http.createServer();
  const shutdown = createShutdown({ server, closeSockets: () => new Promise(() => {}),
    closeWorkers: async () => {}, disconnectDatabase: async () => {}, timeoutMs: 20 });
  await assert.rejects(shutdown(), /exceeded its deadline/);
});
test('07,40: cloud originals use authenticated delivery, expiring downloads and matching deletion options', async () => {
  const env = require('../src/config/env'), cloudinary = require('cloudinary').v2;
  const oldEnv = { CLOUDINARY_CLOUD_NAME: env.CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY: env.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: env.CLOUDINARY_API_SECRET };
  const oldUpload = cloudinary.uploader.upload_stream, oldDestroy = cloudinary.uploader.destroy;
  let uploadOptions, deletion;
  Object.assign(env, { CLOUDINARY_CLOUD_NAME: 'test-cloud', CLOUDINARY_API_KEY: 'synthetic-key', CLOUDINARY_API_SECRET: 'synthetic-secret' });
  const modulePath = require.resolve('../src/config/cloudinary'); delete require.cache[modulePath];
  cloudinary.uploader.upload_stream = (options, callback) => {
    uploadOptions = options; return { end: () => callback(null, { public_id: 'folder/resume', resource_type: 'raw' }) };
  };
  cloudinary.uploader.destroy = async (id, options) => { deletion = { id, options }; return { result: 'ok' }; };
  try {
    const storage = require(modulePath), file = await storage.uploadFile(Buffer.from('PRIVATE'), { filename: 'resume.txt', public_id: 'resume' });
    assert.equal(uploadOptions.type, 'authenticated'); assert.equal(uploadOptions.resource_type, 'raw');
    const record = { originalFileStorage: file.storage };
    const download = new URL(storage.getOriginalDownload(record).url);
    assert.equal(download.searchParams.get('type'), 'authenticated');
    assert(Number(download.searchParams.get('expires_at')) <= Math.floor(Date.now() / 1000) + 61);
    await storage.deleteFile(record);
    assert.equal(deletion.options.type, 'authenticated'); assert.equal(deletion.id, 'folder/resume');
    await storage.deleteFile({ originalFileUrl: 'https://res.cloudinary.com/test-cloud/image/upload/v123/folder/legacy.pdf' });
    assert.equal(deletion.id, 'folder/legacy'); assert.equal(deletion.options.resource_type, 'image');
    assert.throws(() => storage.getOriginalDownload({ originalFileStorage: { provider: 'local', filename: '../.env' } }), /Invalid/);
  } finally {
    Object.assign(env, oldEnv); cloudinary.uploader.upload_stream = oldUpload; cloudinary.uploader.destroy = oldDestroy;
    delete require.cache[modulePath];
  }
});
