const { test } = require('node:test'), assert = require('node:assert/strict');
const checks = require('../src/services/claimValidation');
const { preservesResumeDetail } = require('../src/providers/resumeWriting');
const contribution = 'I personally implemented Python validation, checked required fields, displayed clear input errors and documented recovery steps before importing fictional course data.';
const invented = 'Developed a Python-based validator to ensure the integrity of fictional course data before import. Implemented required field checks, generated clear input error messages, and documented recovery procedures. The solution streamlined the import process and reduced data errors.';

test('Phase 3: an unknown outcome cannot become a qualitative result from implementation details', () => {
  const issues = checks.issues(invented, 'Built Python validation.\n' + contribution);
  assert(issues.some((issue) => issue.includes('streamlined')));
  assert(issues.some((issue) => issue.includes('reduced data errors')));
  assert.deepEqual(checks.issues(contribution, contribution), []);
  for (const statement of ['Reduced data errors.', 'Improved reliability.', 'Accelerated imports.', 'Saved manual review time.', 'Resulted in fewer errors.', 'Ensured data integrity.']) assert(checks.outcomeIssues(statement, contribution).length, statement);
});

test('Phase 3: Groq factual correction is requested for unsupported qualitative impact', async () => {
  const Groq = require('../src/providers/groqProvider'), provider = new Groq();
  const source = { summary: 'Python developer.', skills: { all: ['Python'] }, workExperience: [], projects: [{ title: 'Course importer', description: 'Built Python validation.', technologies: ['Python'], highlights: [contribution], link: '' }] };
  const responses = [structuredClone(source), structuredClone(source)], prompts = [];
  responses[0].projects[0].description = invented;
  provider._callChatCompletion = async (system) => { prompts.push(system); return responses[prompts.length - 1]; };
  const result = await provider.tailorResume({ resumeData: source, targetRole: 'Backend Engineer' });
  assert.equal(prompts.length, 2);
  assert(prompts[1].includes('Factual correction:'));
  assert(prompts[1].includes('claimed outcome'));
  assert.equal(result.projects[0].description, source.projects[0].description);
});

test('Phase 3: actual entry outcomes permit wording changes but other targets and uncertain benefits do not', () => {
  assert.deepEqual(checks.outcomeIssues('Decreased errors.', 'Reduced errors after adding validation.'), []);
  assert.deepEqual(checks.outcomeIssues('Streamlined imports.', 'Accelerated imports through validation.'), []);
  assert.deepEqual(checks.outcomeIssues('Improved reliability and performance.', 'Improved reliability and performance.'), []);
  assert(checks.outcomeIssues('Reduced errors.', 'Reduced import time.').length);
  assert(checks.outcomeIssues('Eliminated errors.', 'Reduced errors.').length);
  assert(checks.outcomeIssues('Improved error counts.', 'Increased error counts.').length);
  assert(checks.outcomeIssues('Improved reliability and performance.', 'Improved reliability.').length);
  for (const source of ['Did not reduce errors.', 'Never reduced errors.', 'Reduced no errors.', 'Unable to reduce errors.', 'Aimed to reduce errors.', 'Designed to reduce errors.', 'Validation could reduce errors.', 'Reduced errors: outcome unknown.', 'Reduced errors was not verified.']) assert(checks.outcomeIssues('Reduced errors.', source).length, source);
  assert.deepEqual(checks.outcomeIssues('Did not reduce errors; the outcome is unknown.', contribution), []);
  assert.deepEqual(checks.outcomeIssues('Built validation to reduce errors.', contribution), []);
});

test('Phase 3: provider validation cannot borrow a qualitative outcome from another project or the job target', () => {
  const source = { summary: 'Python developer.', skills: { all: ['Python'] }, projects: [
    { title: 'Course importer', description: 'Built Python validation.', technologies: ['Python'], highlights: [contribution], link: '' },
    { title: 'Other project', description: 'Reduced data errors and streamlined the import process.', technologies: [], highlights: [], link: '' },
  ], workExperience: [] };
  const candidate = structuredClone(source);
  assert.equal(preservesResumeDetail(candidate, source), true);
  candidate.projects[0].description = invented;
  assert.equal(preservesResumeDetail(candidate, source), false);
  const records = source.projects.map((entry, index) => ({ id: String(index + 1).padStart(24, '0'), revision: 1, title: entry.title, statement: entry.description, technologies: entry.technologies, verification: 'confirmed', context: { section: 'projects', entryId: 'project-' + index } }));
  for (const content of [source, candidate]) content.projects.forEach((entry, index) => { entry.entryId = 'project-' + index; });
  const report = require('../src/services/claimEvidenceService').evaluate(source, candidate, records, { withhold: true });
  assert.equal(report.content.projects[0].description, source.projects[0].description);
  assert(report.claims.some((claim) => claim.status === 'withheld' && claim.issues.some((issue) => issue.includes('outcome'))));
});
