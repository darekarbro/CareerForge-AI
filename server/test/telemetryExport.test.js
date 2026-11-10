const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');
test('real OTLP HTTP trace and metric exporters reach a collector without candidate data', async () => {
  const requests = [];
  const server = http.createServer((req, res) => {
    const chunks = []; req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => { requests.push({ path: req.url, body: Buffer.concat(chunks).toString() }); res.setHeader('Content-Type', 'application/json'); res.end('{}'); });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const source = "require('./test/setup.cjs');process.env.OTEL_EXPORTER_OTLP_ENDPOINT=process.argv[1];const t=require('./src/services/telemetry');t.span('export.probe',{},async()=>t.measure('careerforge.probe',1)).then(()=>t.flush()).then(()=>t.shutdown()).catch(e=>{console.error(e);process.exitCode=1})";
    const child = spawn(process.execPath, ['-e', source, 'http://127.0.0.1:' + server.address().port], { cwd: path.resolve(__dirname, '..'), windowsHide: true });
    let output = ''; child.stderr.on('data', (data) => { output += data; });
    const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
    assert.equal(code, 0, output);
    assert(requests.some((request) => request.path === '/v1/traces'));
    assert(requests.some((request) => request.path === '/v1/metrics'));
    assert(requests.every((request) => !request.body.includes('password') && !request.body.includes('Authorization')));
  } finally { await new Promise((resolve) => server.close(resolve)); }
});
