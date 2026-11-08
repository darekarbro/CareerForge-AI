const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const evaluatorFiles = ['server/scripts/evaluatePhase4.cjs', 'server/evaluation/holdoutProtocol.cjs'];
const evaluatorFingerprint = () => sha256(evaluatorFiles.map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n'));
const resolve = file => {
  const filename = path.resolve(root, file);
  if (!filename.startsWith(root + path.sep)) throw new Error('Protocol files must be inside the repository.');
  return filename;
};

function validateFreeze(protocol, lock, observed) {
  const fail = message => { throw new Error('Holdout freeze mismatch: ' + message); };
  if (protocol.runId !== lock.runId || protocol.datasetVersion !== observed.datasetVersion || lock.datasetVersion !== observed.datasetVersion) fail('run or dataset identity');
  if (JSON.stringify(observed.splits) !== JSON.stringify(['holdout'])) fail('first pass must score only holdout');
  if (protocol.rubricVersion !== observed.rubricVersion) fail('rubric version');
  if (protocol.implementationSha256 !== observed.implementationSha256 || lock.implementationSha256 !== observed.implementationSha256) fail('assessment implementation changed');
  if (protocol.metricsSha256 !== observed.metricsSha256 || lock.metricsSha256 !== observed.metricsSha256) fail('metric definitions changed');
  if (lock.evaluatorSha256 !== observed.evaluatorSha256) fail('evaluator changed after dataset lock');
  if (lock.datasetSha256 !== observed.datasetSha256) fail('dataset or labels changed');
  if (protocol.plannedCases !== observed.cases || Object.keys(protocol.plannedGroups).length !== Object.keys(observed.groups).length
    || Object.entries(protocol.plannedGroups).some(([group, count]) => observed.groups[group] !== count)) fail('preregistered case counts');
  if (lock.protocolSha256 !== observed.protocolSha256) fail('preregistered protocol changed');
  if (observed.outputPath !== lock.outputPath) fail('first-pass output path');
}

function beginFirstPass(lockPath, observed) {
  const lockFile = resolve(lockPath), lockBytes = fs.readFileSync(lockFile), lock = JSON.parse(lockBytes);
  const protocolBytes = fs.readFileSync(resolve(lock.protocolPath)), protocol = JSON.parse(protocolBytes);
  validateFreeze(protocol, lock, { ...observed, protocolSha256: sha256(protocolBytes) });
  const outputFile = resolve(lock.outputPath), receiptFile = resolve(lock.receiptPath);
  if (fs.existsSync(outputFile)) throw new Error('The first-pass output already exists; preserve it and use a regression run.');
  const receipt = { runId: lock.runId, state: 'started', startedAt: new Date().toISOString(), datasetVersion: observed.datasetVersion,
    datasetSha256: observed.datasetSha256, implementationSha256: observed.implementationSha256, metricsSha256: observed.metricsSha256,
    evaluatorSha256: observed.evaluatorSha256, protocolSha256: sha256(protocolBytes), lockSha256: sha256(lockBytes), outputPath: lock.outputPath,
    frozenCommit: protocol.frozenCommit, completedCases: 0 };
  fs.mkdirSync(path.dirname(receiptFile), { recursive: true });
  // A prior started, completed or failed attempt cannot be silently presented as a new first pass.
  fs.writeFileSync(receiptFile, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
  const { state, completedCases, ...freezeEvidence } = receipt;
  return { receipt, receiptFile, outputFile, metadata: { ...freezeEvidence, receiptPath: lock.receiptPath, protocolPath: lock.protocolPath, lockPath } };
}

function completeFirstPass(context, report) {
  const content = JSON.stringify(report, null, 2) + '\n';
  fs.mkdirSync(path.dirname(context.outputFile), { recursive: true });
  fs.writeFileSync(context.outputFile, content, { flag: 'wx' });
  const receipt = { ...context.receipt, state: 'completed', completedAt: new Date().toISOString(),
    completedCases: Object.values(report.splits).reduce((sum, split) => sum + split.cases.length, 0), reportSha256: sha256(content) };
  fs.writeFileSync(context.receiptFile, JSON.stringify(receipt, null, 2) + '\n');
}

function failFirstPass(context, error, completedCases) {
  if (context) fs.writeFileSync(context.receiptFile, JSON.stringify({ ...context.receipt, state: 'failed', failedAt: new Date().toISOString(), completedCases, error: error.message }, null, 2) + '\n');
}

function requirePublishedRegression(version, output) {
  const receiptFile = path.join(__dirname, `protocols/${version}-first-pass.receipt.json`);
  if (!fs.existsSync(receiptFile)) throw new Error('Fresh holdout scoring requires an explicit frozen --first-pass lock.');
  const receipt = JSON.parse(fs.readFileSync(receiptFile, 'utf8'));
  if (receipt.state !== 'completed' || sha256(fs.readFileSync(resolve(receipt.outputPath))) !== receipt.reportSha256) {
    throw new Error('The initial holdout run is incomplete or its preserved output changed.');
  }
  if (output && path.resolve(output) === resolve(receipt.outputPath)) throw new Error('Use a different output path; the first-pass report is preserved.');
}

module.exports = { sha256, evaluatorFiles, evaluatorFingerprint, validateFreeze, beginFirstPass, completeFirstPass, failFirstPass, requirePublishedRegression };
