const test = require('node:test');
const assert = require('node:assert/strict');
const Provider = require('../src/providers/deterministicProvider');
const { assessMatch } = require('../src/services/requirementMatching');
const { validateResult } = require('../src/providers/validateResult');
const { evaluateCase, validCitation } = require('../evaluation/metrics.cjs');
const publishedCases = require('../evaluation/dataset/v2/holdout.json').cases;
const provider = new Provider();

test('published v2 cases are regression checks for skills, contradiction decisions and valid source metadata', async () => {
  for (const fixture of publishedCases) {
    const parsed = await provider.parseResume(fixture.resumeText);
    const match = assessMatch({ resumeData: parsed, jobDescriptionText: fixture.jobDescriptionText });
    const result = evaluateCase(fixture, parsed, match);
    assert.deepEqual(result.failures.missingSkills, [], fixture.id);
    assert.deepEqual(result.failures.unexpectedSkills, [], fixture.id);
    assert.deepEqual(result.failures.requirements, [], fixture.id);
    assert.equal(validateResult('parseResume', parsed, fixture.resumeText), parsed, fixture.id);
    for (const row of match.requirementMatches) for (const citation of [...row.supportingEvidence, ...(row.conflictingEvidence || [])]) {
      assert(validCitation(parsed, citation), fixture.id + ': ' + JSON.stringify(citation));
    }
  }
});

test('unknown headings retain exact personal claims and denials without crediting other people or aspirations', async () => {
  const source = 'Sia Vale\nsia@candidate.example\nUnfamiliar section\nI built Python validators.\nMy colleague said: "I use React.\nI use AWS."\nMy next learning goal is TensorFlow.\nDifferent label\nI have no Python skills.';
  const parsed = await provider.parseResume(source);
  assert.deepEqual(parsed.skills.all, []);
  assert(parsed.summary.includes('I built Python validators.'));
  assert(parsed.summary.includes('I have no Python skills.'));
  assert(parsed.warnings.some(warning => warning.includes('retained verbatim')));
  const report = assessMatch({ resumeData: parsed, jobDescriptionText: 'Python, React, AWS and TensorFlow required.' });
  assert.equal(report.requirementMatches.find(row => row.label === 'Python').status, 'uncertain');
  for (const row of report.requirementMatches.filter(row => row.label !== 'Python')) assert.equal(row.status, 'missing');
  assert.equal(validateResult('parseResume', parsed, source), parsed);
});

test('mixed positive and negative statements remain skill-specific when reassessing stored content', () => {
  const data = { summary: 'I use Python but do not know React. I built services without Docker.', skills: { all: [] } };
  const report = assessMatch({ resumeData: data, jobDescriptionText: 'Python, React and Docker required.' });
  assert.equal(report.requirementMatches.find(row => row.label === 'Python').status, 'supported');
  assert.equal(report.requirementMatches.find(row => row.label === 'React').status, 'missing');
  assert.equal(report.requirementMatches.find(row => row.label === 'Docker').status, 'missing');
});

test('wrapped candidate assertions keep exact citations after extraction and matching', async () => {
  const source = 'Sia Vale\nA record of my work\n  I build Python tools,\n    and React interfaces.\n  My deployment environment is Linux.';
  const parsed = await provider.parseResume(source);
  assert.deepEqual(new Set(parsed.skills.all), new Set(['Python', 'React', 'Linux']));
  const report = assessMatch({ resumeData: parsed, jobDescriptionText: 'Python, React and Linux required.' });
  assert(report.requirementMatches.every(row => row.status === 'supported'));
  for (const row of report.requirementMatches) assert(row.supportingEvidence.every(item => validCitation(parsed, item)));
  assert.equal(validateResult('parseResume', parsed, source), parsed);
});
