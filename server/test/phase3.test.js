const { test } = require('node:test'), assert = require('node:assert/strict');
const checks = require('../src/services/claimValidation');
const { preservesResumeDetail } = require('../src/providers/resumeWriting');
const imports = require('../src/services/evidenceImportService');
test('Phase 3: quantities, technologies and leadership cannot migrate between experience entries', () => {
  assert(checks.issues('Led 12 developers using Kubernetes.', 'Built a Python validator.').length >= 3);
  assert.deepEqual(checks.issues('Built Python validation for 12 users.', 'Built a Python validator for 12 users.'), []);
  assert(checks.issues('Deployed a production API.', 'Implemented a local API.').some((issue) => issue.includes('production')));
  assert.deepEqual(checks.quantities('१२ users, 1,200 rows and 2,5% improvement'), ['12', '1200', '2.5']);
  assert(checks.issues('Reduced errors by 25%.', 'Reduced errors by 2,5%.').length > 0);
  assert(checks.issues('Built tooling for 12 users.', 'Collaborated with 12 developers.').length > 0);
  assert(checks.issues('Collaborated in a three‑person team.', 'Collaborated with three developers.').length > 0);
  const source = { summary: 'Python and Kubernetes work.', skills: { all: ['Python', 'Kubernetes'], technical: ['Python', 'Kubernetes'] }, projects: [], workExperience: [{ role: 'Engineer', company: 'First', highlights: ['Built Python tooling.'] }, { role: 'Engineer', company: 'Second', highlights: ['Deployed Kubernetes for 12 users.'] }] };
  const candidate = { ...structuredClone(source), diffFromOriginal: { addedSkills: [] } }; candidate.workExperience[0].highlights = ['Built Python and Kubernetes tooling for 12 users.'];
  assert.equal(preservesResumeDetail(candidate, source), false);
});
test('Phase 3: public repository import rejects credentials, redirects through arbitrary paths and other hosts', () => {
  for (const url of ['http://github.com/you/project', 'https://github.com.evil.test/you/project', 'https://you:secret@github.com/you/project', 'https://github.com/you/project/tree/main', 'https://127.0.0.1/you/project', 'https://github.com/you/project?url=https://localhost', 'https://github.com/you/project#instructions']) assert.throws(() => imports.repository(url));
  assert.deepEqual(imports.repository('https://github.com/you/project.git'), { owner: 'you', repo: 'project', url: 'https://github.com/you/project' });
});
test('Phase 3: provenance withholds unsupported wording and cites only its own project', () => {
  const source = { summary: '', projects: [{ entryId: 'python', title: 'Python Project', description: 'Built Python validation.', highlights: [] }, { entryId: 'other', title: 'Other Project', description: 'Deployed Kubernetes for 30 users.', highlights: [] }] };
  const records = source.projects.map((entry, index) => ({ id: String(index + 1).padStart(24, '0'), revision: 1, title: entry.title, statement: entry.description, technologies: [], context: { section: 'projects', entryId: entry.entryId }, source: { quote: entry.description }, verification: 'confirmed' }));
  const candidate = structuredClone(source); candidate.projects[0].description = 'Led 30 developers deploying Kubernetes.';
  const report = require('../src/services/claimEvidenceService').evaluate(source, candidate, records, { withhold: true });
  assert.equal(report.content.projects[0].description, source.projects[0].description); assert.equal(report.summary.withheld, 1);
  const claim = report.claims.find((item) => item.status === 'withheld'); assert(claim.withheldText.includes('Kubernetes')); assert(claim.citations.every((item) => item.context.entryId === 'python'));
});
