const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { sha256, validateFreeze, beginFirstPass, completeFirstPass } = require('../evaluation/holdoutProtocol.cjs');

const protocol = { runId: 'fixture-initial', datasetVersion: 'fixture-v2', rubricVersion: 'frozen-rubric', frozenCommit: 'fixture-commit',
  implementationSha256: 'implementation', metricsSha256: 'metrics', plannedCases: 2, plannedGroups: { formatting: 1, contradictory_skills: 1 } };
const lock = { runId: protocol.runId, datasetVersion: protocol.datasetVersion, implementationSha256: 'implementation', metricsSha256: 'metrics',
  evaluatorSha256: 'evaluator', datasetSha256: 'dataset', protocolSha256: 'protocol', outputPath: '.test-tmp/fixture-report.json' };
const observed = { ...lock, rubricVersion: 'frozen-rubric', splits: ['holdout'], cases: 2, groups: { contradictory_skills: 1, formatting: 1 } };

test('first-pass freeze rejects implementation, metric, evaluator, label and protocol changes before scoring', () => {
  validateFreeze(protocol, lock, observed);
  for (const key of ['implementationSha256', 'metricsSha256', 'evaluatorSha256', 'datasetSha256', 'protocolSha256', 'rubricVersion', 'outputPath']) {
    assert.throws(() => validateFreeze(protocol, lock, { ...observed, [key]: 'changed' }), /freeze mismatch/, key);
  }
  assert.throws(() => validateFreeze(protocol, lock, { ...observed, cases: 3 }), /case counts/);
  assert.throws(() => validateFreeze(protocol, lock, { ...observed, splits: ['development', 'holdout'] }), /only holdout/);
});

test('first-pass receipt prevents a repeated initial run and preserves the completed raw report', () => {
  const root = path.resolve(__dirname, '../..'), temporary = path.join(root, '.test-tmp');
  fs.mkdirSync(temporary, { recursive: true });
  const directory = fs.mkdtempSync(path.join(temporary, 'holdout-protocol-fixture-'));
  const relative = file => path.relative(root, path.join(directory, file)).split(path.sep).join('/');
  try {
    const protocolText = JSON.stringify(protocol), localLock = { ...lock, protocolPath: relative('protocol.json'),
      protocolSha256: sha256(protocolText), outputPath: relative('report.json'), receiptPath: relative('receipt.json') };
    fs.writeFileSync(path.join(directory, 'protocol.json'), protocolText);
    fs.writeFileSync(path.join(directory, 'lock.json'), JSON.stringify(localLock));
    const input = { ...observed, outputPath: localLock.outputPath };
    const context = beginFirstPass(relative('lock.json'), input);
    assert.equal(JSON.parse(fs.readFileSync(context.receiptFile)).state, 'started');
    assert.throws(() => beginFirstPass(relative('lock.json'), input), /EEXIST/);
    const fixtureReport = { splits: { holdout: { cases: [{ id: 'fixture-one' }, { id: 'fixture-two' }] } } };
    completeFirstPass(context, fixtureReport);
    const receipt = JSON.parse(fs.readFileSync(context.receiptFile));
    assert.equal(receipt.state, 'completed'); assert.equal(receipt.completedCases, 2);
    assert.equal(receipt.reportSha256, sha256(fs.readFileSync(context.outputFile)));
    assert.throws(() => beginFirstPass(relative('lock.json'), input), /output already exists/);
    assert.deepEqual(JSON.parse(fs.readFileSync(context.outputFile)), fixtureReport);
  } finally {
    if (path.resolve(directory).startsWith(temporary + path.sep)) fs.rmSync(directory, { recursive: true, force: true });
  }
});
