const test = require('node:test');
const assert = require('node:assert/strict');
const previous = [...require('../evaluation/dataset/v1/development.json').cases, ...require('../evaluation/dataset/v1/holdout.json').cases];
const { SKILLS } = require('../src/providers/resumeFacts');
const normalize = value => value.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();

// Structural/reference validation only. This test never calls a parser, matcher or scoring function.
const holdouts = ['v2', 'v3', 'v4'];
for (const [index, version] of holdouts.entries()) test(version + ' holdout is disjoint, synthetic and structurally valid without executing predictions', () => {
  const dataset = require('../evaluation/dataset/' + version + '/holdout.json');
  const protocol = require('../evaluation/protocols/' + version + '-first-pass.json');
  assert.equal(dataset.datasetVersion, protocol.datasetVersion); assert.equal(dataset.split, 'holdout');
  assert.equal(dataset.cases.length, protocol.plannedCases);
  assert.equal(dataset.provenance.implementationAccess, false); assert.equal(dataset.provenance.priorFixtureAccess, false);
  const earlier = [...previous, ...holdouts.slice(0, index).flatMap(earlierVersion => require('../evaluation/dataset/' + earlierVersion + '/holdout.json').cases)];
  const ids = new Set(earlier.map(item => item.id)), texts = new Set(earlier.map(item => normalize(item.resumeText)));
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
