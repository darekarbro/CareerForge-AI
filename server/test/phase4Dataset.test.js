const test = require('node:test');
const assert = require('node:assert/strict');
const development = require('../evaluation/dataset/v1/development.json');
const holdout = require('../evaluation/dataset/v1/holdout.json');

test('Phase 4 synthetic reference dataset is stratified with a separate holdout', () => {
  assert.equal(development.cases.length, 30);
  assert.equal(holdout.cases.length, 10);
  const ids = new Set();
  for (const [split, size] of [[development, 6], [holdout, 2]]) {
    assert.equal(split.datasetVersion, 'phase4-synthetic-v1');
    for (const group of ['graduate', 'experienced', 'sparse', 'formatting', 'misleading']) {
      assert.equal(split.cases.filter(item => item.group === group).length, size);
    }
    for (const item of split.cases) {
      assert(!ids.has(item.id), 'Cases may not occur in both splits'); ids.add(item.id);
      assert.equal(item.provenance.kind, 'synthetic');
      assert.equal(item.provenance.personalData, 'fictional');
      assert.equal(typeof item.resumeText, 'string');
      assert.equal(typeof item.jobDescriptionText, 'string');
      assert(Array.isArray(item.expectedExtraction.skills));
      assert(item.expectedRequirements.length > 0);
      for (const req of item.expectedRequirements) {
        assert(['requiredSkills', 'preferredSkills'].includes(req.category));
        assert(['supported', 'missing', 'uncertain'].includes(req.status));
      }
    }
  }
});
