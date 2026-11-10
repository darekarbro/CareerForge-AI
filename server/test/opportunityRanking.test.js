const { test } = require('node:test');
const assert = require('node:assert/strict');
const { rank } = require('../src/services/opportunityRanking');
const preferences = { roles: ['Engineer'], locations: ['Pune'], workModes: ['remote'], avoidCompanies: ['Avoid Co'] };
const resume = { _id: 'resume1', contentRevision: 2, verifiedAt: new Date(), parsedData: { skills: { all: ['Python'] }, projects: [{ entryId: 'project1', title: 'Data import', description: 'Built Python validation.' }] } };
const workspace = { company: 'Example', title: 'Backend Engineer', description: 'Required: Python. Preferred: Rust. Remote in Pune.' };
test('ranking explains preference points and preserves skill citations', () => {
  const result = rank(workspace, preferences, resume);
  assert.equal(result.score, 85); // 45/60 skill coverage + 40/40 preferences
  assert(result.reasons.some((reason) => reason.label.includes('Preferred location: Pune')));
  assert.equal(result.evidence[0].skill, 'Python');
  assert.equal(result.evidence[0].citations[0].resumeId, 'resume1');
  assert(result.concerns.some((concern) => concern.includes('Rust')));
  assert.equal(rank({ ...workspace, company: 'Avoid Co' }, preferences, resume).deprioritized, true);
});
test('ranking only uses current confirmed facts in the selected scope', () => {
  const fact = { _id: 'fact1', title: 'Rust service', statement: 'Built Rust services.', verification: 'confirmed', context: { section: 'projects', entryId: 'project1', recordId: 'resume1' }, source: { resumeId: 'resume1', revision: 2 } };
  assert.equal(rank(workspace, preferences, resume, [fact]).score, 100);
  for (const item of [{ ...fact, verification: 'unverified' }, { ...fact, source: { resumeId: 'resume1', revision: 1 } }, { ...fact, context: { ...fact.context, recordId: 'other' } }]) assert.equal(rank(workspace, preferences, resume, [item]).score, 85);
  assert.equal(rank({ ...workspace, resumeSelection: { projects: [] } }, preferences, resume, [fact]).score, 85);
});
test('contradictory evidence earns no supported skill credit, and unknown criteria remain explicit', () => {
  const result = rank({ ...workspace, description: 'Python required.' }, { roles: [], locations: [], workModes: [] }, { ...resume, parsedData: { ...resume.parsedData, summary: 'No Python experience.' } });
  assert.equal(result.score, 0);
  assert.equal(result.evidence.length, 0);
  const unknown = rank({ ...workspace, description: 'Help our customers.' }, { roles: [], locations: [], workModes: [] }, null);
  assert.equal(unknown.score, null); assert(unknown.concerns.length);
});
test('negated work arrangements and locations never earn preference credit', () => {
  for (const description of ['Python required. No remote work; not in Pune.', 'Python required. Remote work is not available. Location excludes Pune.']) {
    const result = rank({ ...workspace, description }, preferences, resume);
    assert.equal(result.reasons.find((reason) => reason.label.startsWith('Preferred work arrangement')).points, 0);
  }
  const location = rank({ ...workspace, description: 'Python required. Work is not in Pune.' }, preferences, resume);
  assert.equal(location.reasons.find((reason) => reason.label.startsWith('Preferred location')).points, 0);
  const conflict = rank({ ...workspace, description: 'Python required. Remote team. Remote work is not offered.' }, preferences, resume);
  assert.equal(conflict.reasons.find((reason) => reason.label.startsWith('Preferred work arrangement')).points, 0);
});
test('evidence record titles do not establish candidate skills absent from the fact statement', () => {
  const result = rank(workspace, preferences, resume, [{ _id: 'fact', title: 'Rust service proposal', statement: 'Created the customer survey.', verification: 'confirmed', source: { kind: 'manual' } }]);
  assert.equal(result.score, 85);
  assert(!result.evidence.some((row) => row.skill === 'Rust'));
});
