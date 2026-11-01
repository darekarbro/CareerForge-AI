const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), fsp = require('node:fs/promises'), path = require('node:path');
const { createRequire } = require('node:module');
async function directory(t) {
  const root = path.resolve(__dirname, '../../.test-tmp'); await fsp.mkdir(root, { recursive: true });
  const folder = await fsp.mkdtemp(path.join(root, 'dependency-compat-'));
  t.after(async () => { assert(path.resolve(folder).startsWith(root + path.sep)); await fsp.rm(folder, { recursive: true, force: true }); });
  return folder;
}

test('Patched glob stops traversing after AbortSignal cancellation', async (t) => {
  const folder = await directory(t), { glob } = require('glob'), controller = new AbortController(), reason = new Error('Synthetic traversal cancellation');
  for (let index = 0; index < 5; index++) { const child = path.join(folder, 'branch-' + index, 'nested'); await fsp.mkdir(child, { recursive: true }); await fsp.writeFile(path.join(child, 'sample.txt'), 'fictional'); }
  let reads = 0, complete;
  const firstRead = new Promise((resolve) => { complete = resolve; });
  const instrumented = { ...fs, readdir(...args) {
    reads++; const callback = args.pop();
    fs.readdir(...args, (...result) => { if (reads === 1) controller.abort(reason); callback(...result); complete(); });
  } };
  await assert.rejects(glob('**/*.txt', { cwd: folder, fs: instrumented, signal: controller.signal }), (error) => error === reason);
  await firstRead; await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(reads, 1, 'Cancellation must not schedule more directory reads');
});

test('Google dependency cleanup retains rimraf glob and synchronous APIs', async (t) => {
  const folder = await directory(t), { rimraf, rimrafSync } = require('rimraf');
  await fsp.writeFile(path.join(folder, 'first.tmp'), 'fictional'); await fsp.writeFile(path.join(folder, 'keep.txt'), 'keep');
  const pattern = path.join(folder, '*.tmp').replaceAll('\\', '/'); assert(path.resolve(folder).startsWith(path.resolve(__dirname, '../../.test-tmp') + path.sep));
  assert.equal(await rimraf(pattern, { glob: true }), true); assert.equal(fs.existsSync(path.join(folder, 'first.tmp')), false); assert.equal(fs.existsSync(path.join(folder, 'keep.txt')), true);
  await fsp.writeFile(path.join(folder, 'second.tmp'), 'fictional'); assert.equal(rimrafSync(pattern, { glob: true }), true); assert.equal(fs.existsSync(path.join(folder, 'second.tmp')), false);
});

test('Nodemon watch filtering retains ignored directories and extension matching', () => {
  const match = require('nodemon/lib/monitor/match'), fromNodemon = createRequire(require.resolve('nodemon'));
  assert.equal(typeof fromNodemon('minimatch').minimatch, 'function');
  const files = ['src/app.js', 'src/readme.md', 'node_modules/example/index.js'].map((file) => path.resolve(file));
  const result = match(files, [path.resolve('src/**').replaceAll('\\', '/'), '!**/node_modules/**'], 'js');
  assert.deepEqual(result.result.map((file) => path.relative(process.cwd(), file)), [path.join('src', 'app.js')]);
});

test('Firebase verifies real signatures with patched dependencies and rejects wrong audience, issuer and expiry', async () => {
  const { generateKeyPairSync } = require('node:crypto'), jwt = require('jsonwebtoken');
  const { initializeApp, deleteApp } = require('firebase-admin/app'), { getAuth } = require('firebase-admin/auth');
  const service = require('../src/services/authService'), originalApp = service.firebaseApp;
  const app = initializeApp({ projectId: 'fictional-dependency-test' }, 'dependency-signature-test');
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const other = generateKeyPairSync('rsa', { modulusLength: 2048 });
  // Replace only the trusted certificate download; signature and claim verification use the real SDK.
  const fetcher = getAuth(app).idTokenVerifier.signatureVerifier.keyFetcher, fetchKeys = fetcher.fetchPublicKeys;
  fetcher.fetchPublicKeys = async () => ({ 'fictional-key': publicKey.export({ type: 'spki', format: 'pem' }) });
  service.firebaseApp = app;
  const sign = (changes = {}, key = privateKey) => jwt.sign({ sub: 'fictional-user', aud: 'fictional-dependency-test', iss: 'https://securetoken.google.com/fictional-dependency-test', email: 'fictional@example.test', email_verified: true, firebase: { sign_in_provider: 'google.com' }, ...changes }, key, { algorithm: 'RS256', keyid: 'fictional-key', expiresIn: 300 });
  try {
    const verified = await service.verifyFirebaseToken(sign()); assert.equal(verified.uid, 'fictional-user'); assert.equal(verified.email_verified, true);
    for (const token of [sign({}, other.privateKey), sign({ aud: 'different-project' }), sign({ iss: 'https://example.test' }), jwt.sign({ sub: 'fictional-user', aud: 'fictional-dependency-test', iss: 'https://securetoken.google.com/fictional-dependency-test' }, privateKey, { algorithm: 'RS256', keyid: 'fictional-key', expiresIn: -1 })]) await assert.rejects(service.verifyFirebaseToken(token), (error) => error.statusCode === 401);
  } finally { service.firebaseApp = originalApp; fetcher.fetchPublicKeys = fetchKeys; await deleteApp(app); }
});
