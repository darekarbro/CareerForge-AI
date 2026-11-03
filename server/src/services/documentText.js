const { Worker, isMainThread, parentPort, workerData } = require('node:worker_threads');
const failure = (message, statusCode = 400, code = 'DOCUMENT_INVALID') => Object.assign(new Error(message), { statusCode, code });
const complex = () => failure('This document is too large or complex to read safely. Use a smaller PDF, DOCX or plain text file.', 413, 'DOCUMENT_TOO_COMPLEX');
function bounded(text, maxChars) { if (text.length > maxChars) throw complex(); return text; }
function createLimiter(concurrency = 2, capacity = 8, waitMs = 15000) {
  let active = 0; const waiting = [];
  return (work, signal) => new Promise((resolve, reject) => {
    let timer;
    const remove = () => { const index = waiting.indexOf(start); if (index >= 0) waiting.splice(index, 1); clearTimeout(timer); signal?.removeEventListener('abort', abort); };
    const abort = () => { remove(); reject(require('./jobContext').cancellationError()); };
    const start = () => { remove(); active++; Promise.resolve().then(work).then(resolve, reject).finally(() => { active--; waiting.shift()?.(); }); };
    if (signal?.aborted) return abort();
    if (active < concurrency) return start();
    if (waiting.length >= capacity) return reject(failure('Document processing is busy. Please try again shortly.', 503, 'DOCUMENT_BUSY'));
    waiting.push(start); signal?.addEventListener('abort', abort, { once: true });
    timer = setTimeout(() => { remove(); reject(failure('Document processing is busy. Please try again shortly.', 503, 'DOCUMENT_BUSY')); }, waitMs);
  });
}
const slots = createLimiter();

async function decode(bytes, type, maxChars) {
  const buffer = Buffer.from(bytes);
  if (type === 'pdf') return bounded((await require('pdf-parse')(new Uint8Array(buffer))).text || '', maxChars);
  if (type === 'docx') {
    const zip = await require('jszip').loadAsync(buffer), files = Object.values(zip.files).filter((file) => !file.dir);
    if (files.length > 500 || files.some((file) => (file._data?.uncompressedSize || 0) > 16 * 1024 * 1024) || files.reduce((sum, file) => sum + (file._data?.uncompressedSize || 0), 0) > 32 * 1024 * 1024) throw complex();
    let expanded = 0;
    // Check actual output too: forged ZIP sizes must not bypass the expansion bound.
    for (const file of files) await new Promise((resolve, reject) => {
      const stream = file.nodeStream(); let entryBytes = 0;
      stream.on('data', (chunk) => { expanded += chunk.length; entryBytes += chunk.length; if (entryBytes > 16 * 1024 * 1024 || expanded > 32 * 1024 * 1024) stream.destroy(complex()); });
      stream.once('error', reject); stream.once('end', resolve);
    });
    return bounded((await require('mammoth').extractRawText({ buffer }, { externalFileAccess: false })).value || '', maxChars);
  }
  try { return bounded(new TextDecoder('utf-8', { fatal: true }).decode(buffer), maxChars); }
  catch (error) { if (error.statusCode) throw error; throw failure('Use a valid UTF-8 text file.'); }
}

function extract(buffer, type, { maxChars = 1000000, timeoutMs = 15000, signal, WorkerType = Worker } = {}) {
  if (buffer.length > 10 * 1024 * 1024) return Promise.reject(complex());
  if (signal?.aborted) return Promise.reject(require('./jobContext').cancellationError());
  if (type === 'txt') return decode(buffer, type, maxChars);
  return slots(() => new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(require('./jobContext').cancellationError()); return; }
    let settled = false;
    const bytes = Uint8Array.from(buffer), worker = new WorkerType(__filename, { workerData: { documentText: true, bytes, type, maxChars }, transferList: [bytes.buffer], execArgv: [], resourceLimits: { maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 16, stackSizeMb: 4 } });
    const finish = (error, value) => { if (settled) return; settled = true; clearTimeout(timer); signal?.removeEventListener('abort', abort); worker.terminate().catch(() => {}).then(() => { if (error) reject(error); else resolve(value); }); };
    const abort = () => finish(require('./jobContext').cancellationError());
    const timer = setTimeout(() => finish(failure('This document took too long to read. Use a smaller or simpler document.', 408, 'DOCUMENT_TIMEOUT')), timeoutMs);
    worker.once('message', (result) => { if (result.error) finish(failure(result.error.message, result.error.statusCode, result.error.code)); else { try { finish(null, bounded(result.text, maxChars)); } catch (error) { finish(error); } } });
    worker.once('error', (error) => finish(error.code === 'ERR_WORKER_OUT_OF_MEMORY' ? complex() : failure('This document could not be read safely.')));
    worker.once('exit', () => { if (!settled) finish(failure('Document reading stopped unexpectedly. Try a smaller document.')); });
    signal?.addEventListener('abort', abort, { once: true }); if (signal?.aborted) abort();
  }), signal);
}
if (!isMainThread && workerData?.documentText) decode(workerData.bytes, workerData.type, workerData.maxChars).then((text) => parentPort.postMessage({ text }), (error) => parentPort.postMessage({ error: { message: error.statusCode ? error.message : 'This document could not be read. Use an unencrypted PDF, DOCX or UTF-8 text file.', statusCode: error.statusCode || 400, code: error.code || 'DOCUMENT_INVALID' } }));
module.exports = { extract, createLimiter };
