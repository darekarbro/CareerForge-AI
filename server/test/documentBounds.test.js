const { test } = require('node:test'), assert = require('node:assert/strict'), { EventEmitter } = require('node:events');
const parser = require('../src/agents/parserAgent'), { extract } = require('../src/services/documentText');
test('Phase 3 readiness: document extraction rejects oversized text, malformed UTF-8 and expanded DOCX archives', async () => {
  await assert.rejects(parser.extractTextFromBuffer(Buffer.from('x'.repeat(48001)), 'txt', { maxChars: 48000 }), (error) => error.statusCode === 413);
  await assert.rejects(parser.extractTextFromBuffer(Buffer.from([0xc3, 0x28]), 'txt'), /UTF-8/);
  const zip = new (require('jszip'))(); zip.file('word/document.xml', '<xml>' + 'x'.repeat(17 * 1024 * 1024) + '</xml>');
  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }); assert(buffer.length < 100000);
  await assert.rejects(parser.extractTextFromBuffer(buffer, 'docx', { maxChars: 48000 }), (error) => error.statusCode === 413);
  const forged = Buffer.from(buffer), marker = Buffer.from([0x50, 0x4b, 0x01, 0x02]); let central = -1, cursor = 0;
  while ((cursor = forged.indexOf(marker, cursor)) >= 0) { if (forged.subarray(cursor + 46, cursor + 46 + forged.readUInt16LE(cursor + 28)).toString() === 'word/document.xml') { central = cursor; break; } cursor++; }
  assert(central >= 0); forged.writeUInt32LE(32, central + 24); assert.equal((await require('jszip').loadAsync(forged)).files['word/document.xml']._data.uncompressedSize, 32);
  await assert.rejects(parser.extractTextFromBuffer(forged, 'docx', { maxChars: 48000 }), (error) => [400, 413].includes(error.statusCode));
});
test('Phase 3 readiness: bounded DOCX extraction preserves valid Unicode text', async () => {
  const { Document, Packer, Paragraph } = require('docx');
  const buffer = await Packer.toBuffer(new Document({ sections: [{ children: [new Paragraph('Fictional contribution by José: implemented Python validation.')] }] }));
  assert((await parser.extractTextFromBuffer(buffer, 'docx', { maxChars: 48000 })).includes('José: implemented Python validation.'));
});
test('Phase 3 readiness: parser deadlines and job cancellation terminate the extraction worker', async () => {
  let stopped = 0;
  class SilentWorker extends EventEmitter { terminate() { stopped++; return Promise.resolve(1); } }
  await assert.rejects(extract(Buffer.from('synthetic'), 'pdf', { WorkerType: SilentWorker, timeoutMs: 10 }), (error) => error.code === 'DOCUMENT_TIMEOUT'); assert.equal(stopped, 1);
  const controller = new AbortController(), waiting = extract(Buffer.from('synthetic'), 'pdf', { WorkerType: SilentWorker, signal: controller.signal }); await Promise.resolve(); controller.abort();
  await assert.rejects(waiting, (error) => error.code === 'JOB_CANCELLED'); assert.equal(stopped, 2);
});
test('Phase 3 readiness: parser concurrency, waiting capacity and queued cancellation are bounded', async () => {
  const { createLimiter } = require('../src/services/documentText'), limit = createLimiter(1, 1, 1000), controller = new AbortController(); let release, queuedRan = false;
  const active = limit(() => new Promise((resolve) => { release = resolve; })); await Promise.resolve();
  const waiting = limit(async () => { queuedRan = true; }, controller.signal);
  await assert.rejects(limit(async () => {}), (error) => error.code === 'DOCUMENT_BUSY'); controller.abort(); await assert.rejects(waiting, (error) => error.code === 'JOB_CANCELLED');
  release(); await active; await new Promise((resolve) => setImmediate(resolve)); await limit(async () => {}); assert.equal(queuedRan, false);
  const shortWait = createLimiter(1, 1, 10); let finish;
  const held = shortWait(() => new Promise((resolve) => { finish = resolve; })); await Promise.resolve(); await assert.rejects(shortWait(async () => {}), (error) => error.code === 'DOCUMENT_BUSY'); finish(); await held;
});
