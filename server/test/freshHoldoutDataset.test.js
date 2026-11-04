const test = require('node:test');
const assert = require('node:assert/strict');
const dataset = require('../evaluation/dataset/v2/holdout.json');
const protocol = require('../evaluation/protocols/v2-first-pass.json');
const previous = [...require('../evaluation/dataset/v1/development.json').cases, ...require('../evaluation/dataset/v1/holdout.json').cases];
const { SKILLS } = require('../src/providers/resumeFacts');
const normalize = value => value.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();

// Structural/reference validation only. This test never calls a parser, matcher or scoring function.
test('fresh holdout is disjoint, synthetic and structurally valid without executing predictions', () => {
  assert.equal(dataset.datasetVersion, protocol.datasetVersion); assert.equal(dataset.split, 'holdout');
  assert.equal(dataset.cases.length, protocol.plannedCases);
  assert.equal(dataset.provenance.implementationAccess, false); assert.equal(dataset.provenance.priorFixtureAccess, false);
  const ids = new Set(previous.map(item => item.id)), texts = new Set(previous.map(item => normalize(item.resumeText)));
  for (const [group, count] of Object.entries(protocol.plannedGroups)) assert.equal(dataset.cases.filter(item => item.group === group).length, count);
  for (const item of dataset.cases) {
    assert(!ids.has(item.id), 'A case ID overlaps another case'); ids.add(item.id);
    assert(!texts.has(normalize(item.resumeText)), 'Resume text duplicates an earlier example'); texts.add(normalize(item.resumeText));
    assert.equal(item.provenance.kind, 'synthetic'); assert.equal(item.provenance.personalData, 'fictional');
    assert.equal(item.provenance.consent, 'not-applicable');
    assert.equal(typeof item.resumeText, 'string'); assert(item.resumeText.trim());
    assert.equal(typeof item.jobDescriptionText, 'string'); assert(item.jobDescriptionText.trim());
    for (const field of ['name', 'email']) assert.equal(typeof item.expectedExtraction.contactInfo[field], 'string');
    assert.equal(new Set(item.expectedExtraction.skills).size, item.expectedExtraction.skills.length);
    assert(item.expectedExtraction.skills.every(skill => SKILLS.includes(skill)), 'Gold extraction must use the documented canonical vocabulary');
    assert(item.expectedRequirements.length > 0);
    const keys = new Set();
    for (const requirement of item.expectedRequirements) {
      assert(['requiredSkills', 'preferredSkills'].includes(requirement.category)); assert(SKILLS.includes(requirement.label));
      assert(['supported', 'missing', 'uncertain'].includes(requirement.status));
      const key = requirement.category + ':' + requirement.label; assert(!keys.has(key)); keys.add(key);
    }
    assert(item.notes?.trim(), 'Every reference annotation needs a rationale');
  }
});
