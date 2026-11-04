const test = require('node:test');
const assert = require('node:assert/strict');
const Provider = require('../src/providers/deterministicProvider');
const { assessMatch } = require('../src/services/requirementMatching');
const { validateResult } = require('../src/providers/validateResult');
const { evaluateCase, validCitation } = require('../evaluation/metrics.cjs');
const { reconcileSkillConflicts } = require('../src/providers/skillConflicts');
const dataset = require('../evaluation/dataset/v3/holdout.json');
const provider = new Provider();

// These cases are public and used for regression, never presented as unseen evaluation.
for (const fixture of dataset.cases) test('published v3 regression: ' + fixture.id, async () => {
  const parsed = await provider.parseResume(fixture.resumeText);
  const match = assessMatch({ resumeData: parsed, jobDescriptionText: fixture.jobDescriptionText });
  const measured = evaluateCase(fixture, parsed, match);
  assert.deepEqual(measured.failures, { unexpectedSkills: [], missingSkills: [], contacts: [], requirements: [] });
  assert.equal(validateResult('parseResume', parsed, fixture.resumeText), parsed);
  assert.deepEqual(reconcileSkillConflicts(parsed), parsed, 'reassessment must preserve withheld claims and active denials');
  for (const row of match.requirementMatches) for (const citation of [...row.supportingEvidence, ...(row.conflictingEvidence || [])]) {
    assert(validCitation(parsed, citation), JSON.stringify(citation));
  }
});

test('v3 unsafe decisions stay withheld when assertion order and quote layout change', async () => {
  const listed = 'Delivery skills\nGit, Linux, Docker, CI/CD';
  const denied = 'Candidate clarification\nI cannot build or operate CI/CD pipelines, and I have never used CI/CD tooling.';
  for (const source of [listed + '\n\n' + denied, denied + '\n\n' + listed]) {
    const parsed = await provider.parseResume('Ada Vale\n' + source);
    const report = assessMatch({ resumeData: parsed, jobDescriptionText: 'CI/CD, Git and Linux required.' });
    assert.equal(report.requirementMatches.find(row => row.label === 'CI/CD').status, 'uncertain');
    assert.deepEqual(new Set(parsed.skills.all), new Set(['Git', 'Linux', 'Docker']));
  }
  for (const quote of ['“Our lead uses Rust and Kubernetes.”', '"Our lead uses Rust\nand Kubernetes."']) {
    const parsed = await provider.parseResume('Ada Vale\nMy skills: Python.\nReference context — quoted from the hiring manager\n' + quote);
    const report = assessMatch({ resumeData: parsed, jobDescriptionText: 'Python, Rust and Kubernetes required.' });
    assert.deepEqual(parsed.skills.all, ['Python']);
    assert.equal(report.requirementMatches.find(row => row.label === 'Python').status, 'supported');
    for (const label of ['Rust', 'Kubernetes']) assert.equal(report.requirementMatches.find(row => row.label === label).status, 'missing');
  }
});
