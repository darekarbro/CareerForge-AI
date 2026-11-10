// Owns a uniquely named, disposable Compose project. Never operates on the user's stack.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..'), project = 'careerforge-phase6-' + crypto.randomBytes(4).toString('hex');
const env = { ...process.env, COMPOSE_PROJECT_NAME: project, GROQ_API_KEY: '', OPENROUTER_API_KEY: '', GEMINI_API_KEY: '',
  FIREBASE_PROJECT_ID: '', FIREBASE_CLIENT_EMAIL: '', FIREBASE_PRIVATE_KEY: '', AI_MODEL_POLICY_PATH: '' };
const report = { startedAt: new Date().toISOString(), project, data: 'fictional only', checks: [], passed: false };
const output = path.join(root, '.test-tmp/phase6-containers.json');
function command(file, args, options = {}) {
  const result = spawnSync(file, args, { cwd: root, env, encoding: 'utf8', windowsHide: true, timeout: 900000, maxBuffer: 8 * 1024 * 1024, ...options });
  if (result.error || result.status !== 0) throw new Error(file + ' failed: ' + (result.error?.message || result.stderr || result.stdout).slice(-3000));
  return result.stdout;
}
const compose = (...args) => command('docker', ['compose', '--env-file', '.env.compose', '-p', project, ...args]);
async function until(work) { const end = Date.now() + 90000; while (Date.now() < end) { if (await work()) return; await new Promise((resolve) => setTimeout(resolve, 1000)); } throw new Error('Container recovery timed out'); }
(async () => {
  let created = false;
  try {
    command('docker', ['info', '--format', '{{.ServerVersion}}']);
    created = true; compose('up', '--build', '-d', '--wait', '--wait-timeout', '240');
    const result = command(process.execPath, ['scripts/testCompose.cjs']);
    assertContains(result, 'PASS Redis outage'); assertContains(result, 'PASS API queues without executing'); assertContains(result, 'PASS SMTP password recovery');
    report.checks.push('real Redis outage with MongoDB worker recovery', 'producer queues while independent worker is stopped', 'private archive and account deletion');
    compose('stop', 'mongo');
    await until(async () => { try { return (await fetch('http://localhost:5000/api/health', { signal: AbortSignal.timeout(8000) })).status === 503; } catch { return false; } });
    compose('start', 'mongo');
    await until(async () => { try { return (await fetch('http://localhost:5000/api/health', { signal: AbortSignal.timeout(8000) })).ok; } catch { return false; } });
    report.checks.push('real MongoDB service stop/start returns 503 then readiness recovers');
    report.passed = true; console.log('PASS Phase 6 container fault drills');
  } catch (error) { report.error = error.message; console.error(error.message); process.exitCode = 1; }
  finally {
    // No pre-existing resources use this random project name; only fixture volumes are removed.
    if (created) { try { compose('down', '--volumes', '--remove-orphans'); } catch (error) { report.cleanupError = error.message; report.passed = false; process.exitCode = 1; } }
    fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, JSON.stringify(report, null, 2));
  }
})();
function assertContains(value, expected) { if (!value.includes(expected)) throw new Error('Missing evidence: ' + expected); }
