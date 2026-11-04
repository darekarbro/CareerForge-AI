const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Resume = require('../src/models/Resume');
const Tailored = require('../src/models/TailoredResume');
const editing = require('../src/services/resumeEditingService');
const { cleanResumeContent } = require('../src/services/resumeContent');
const { activeSkillConflicts, conflictWarnings } = require('../src/providers/skillConflicts');
const { assessMatch } = require('../src/services/requirementMatching');
const { plain } = require('../src/providers/resumeFacts');

const testRoot = path.resolve(__dirname, '../../.test-tmp');
let db, directory;
before(async () => {
  await fs.mkdir(testRoot, { recursive: true });
  directory = await fs.mkdtemp(path.join(testRoot, 'skill-conflicts-'));
  const binaryPath = path.resolve(__dirname, '../node_modules/.cache/mongodb-memory-server/mongod-x64-win32-7.0.24.exe');
  const binary = process.env.MONGOMS_SYSTEM_BINARY ? { systemBinary: process.env.MONGOMS_SYSTEM_BINARY }
    : await fs.stat(binaryPath).then(() => ({ systemBinary: binaryPath }), () => ({}));
  db = await MongoMemoryServer.create({ binary, instance: { dbPath: directory, ip: '127.0.0.1' } });
  await mongoose.connect(db.getUri());
});
after(async () => {
  await mongoose.disconnect(); await db?.stop();
  if (directory && path.resolve(directory).startsWith(testRoot + path.sep)) await fs.rm(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

const original = () => ({
  contactInfo: { name: 'Ash Green', email: 'ash@candidate.example', phone: '' },
  summary: 'I do not know React.',
  skills: { technical: [], frameworks: [], tools: [], soft: [], all: [] },
  workExperience: [], education: [], projects: [], certifications: [],
  skillConflicts: [{ skill: 'React', positiveEvidence: [{ quote: 'React' }], negativeEvidence: [{ path: 'summary', quote: 'I do not know React.' }] }],
});
const sourceText = 'Ash Green\nash@candidate.example\nSkills\nReact\nSummary\nI do not know React.';
async function resume(content = original()) {
  const owner = new mongoose.Types.ObjectId();
  return Resume.create({ owner, title: 'Conflict review', rawText: sourceText, sourceText, processingStatus: 'COMPLETED', parsedData: content, parsingWarnings: conflictWarnings(content) });
}
const currentContent = (record) => cleanResumeContent(plain(record.parsedData || record.reviewedContent || record.tailoredContent));
const status = (content) => assessMatch({ resumeData: content, jobDescriptionText: 'React required.' }).requirementMatches[0].status;

test('contradictory skill evidence survives strict source and tailored model persistence and appears in import review', async () => {
  const record = await resume();
  const stored = await Resume.findById(record._id).lean();
  assert.equal(activeSkillConflicts(stored.parsedData).length, 1);
  assert.deepEqual(stored.parsedData.skills.all, []); assert.equal(status(stored.parsedData), 'uncertain');
  const version = await Tailored.create({ owner: record.owner, resumeId: record._id, targetRole: 'Frontend Engineer', tailoredContent: stored.parsedData, sourceContent: stored.parsedData });
  const savedVersion = await Tailored.findById(version._id).lean();
  assert.equal(activeSkillConflicts(savedVersion.tailoredContent).length, 1);
  assert.equal(status(savedVersion.tailoredContent), 'uncertain');
  const review = await require('../src/services/importReviewService').review(record._id, record.owner);
  assert.equal(review.skillConflicts[0].positiveEvidence[0].quote, 'React');
  assert(review.issues.some((issue) => issue.path[0] === 'skills' && issue.reason.includes('both claimed and denied')));
  assert(!review.issues.some((issue) => issue.path[0] === 'skillConflicts'), 'metadata is not editable resume content');
});

test('source edits preserve active conflicts, clear corrected denials and restore historical conflicts without accepting client metadata', async () => {
  const record = await resume();
  const unrelated = currentContent(record); unrelated.contactInfo.phone = '5550101234';
  let saved = await editing.saveContent(record._id, record.owner, { revision: 1, content: unrelated });
  assert.equal(activeSkillConflicts(saved.parsedData).length, 1);
  assert(saved.parsingWarnings.some((warning) => warning.includes('both claimed and denied')));
  assert.equal(status(saved.parsedData), 'uncertain');
  const readded = currentContent(saved); readded.skills.technical.push('React');
  saved = await editing.saveContent(record._id, record.owner, { revision: 2, content: readded });
  assert.deepEqual([...saved.parsedData.skills.all], []); assert.equal(status(saved.parsedData), 'uncertain');
  const corrected = currentContent(saved); corrected.summary = 'Built a React input form.'; corrected.skills.technical.push('React');
  saved = await editing.saveContent(record._id, record.owner, { revision: 3, content: corrected });
  assert.equal(activeSkillConflicts(saved.parsedData).length, 0); assert.equal(status(saved.parsedData), 'supported');
  assert(!saved.parsingWarnings.some((warning) => warning.includes('both claimed and denied')));
  saved = await editing.restore(record._id, record.owner, { revision: 4, restoreRevision: 1 });
  assert.equal(status(saved.parsedData), 'uncertain'); assert.deepEqual([...saved.parsedData.skills.all], []);
  assert(saved.parsingWarnings.some((warning) => warning.includes('both claimed and denied')));
  const negativeOnly = original(); delete negativeOnly.skillConflicts;
  const separate = await resume(negativeOnly), forged = currentContent(separate);
  forged.skillConflicts = original().skillConflicts;
  const ignored = await editing.saveContent(separate._id, separate.owner, { revision: 1, content: forged });
  assert.equal(activeSkillConflicts(ignored.parsedData).length, 0); assert.equal(status(ignored.parsedData), 'missing');
});

test('tailored edits and historical restores retain only still-active server-owned conflicts', async () => {
  const record = await resume();
  const version = await Tailored.create({ owner: record.owner, resumeId: record._id, targetRole: 'Frontend Engineer', tailoredContent: original(), sourceContent: original() });
  const unrelated = currentContent(version); unrelated.contactInfo.phone = '5550101234';
  let saved = await editing.saveVersion(record._id, version._id, record.owner, { revision: 1, content: unrelated });
  assert.equal(status(saved.reviewedContent), 'uncertain');
  const corrected = currentContent(saved); corrected.summary = 'Built a React input form.'; corrected.skills.technical.push('React');
  saved = await editing.saveVersion(record._id, version._id, record.owner, { revision: 2, content: corrected });
  assert.equal(activeSkillConflicts(saved.reviewedContent).length, 0); assert.equal(status(saved.reviewedContent), 'supported');
  saved = await editing.restoreVersion(record._id, version._id, record.owner, { revision: 3, restoreRevision: 1 });
  assert.equal(status(saved.reviewedContent), 'uncertain'); assert.deepEqual(saved.reviewedContent.skills.all, []);
});

test('saved project reordering relocates denial references and removing the denial clears obsolete conflict flags', async () => {
  const content = original(); content.summary = '';
  content.projects = [
    { entryId: 'validator', title: 'Input validator', description: 'Built Python validation.', technologies: ['Python'], highlights: [] },
    { entryId: 'course-notes', title: 'Course notes', description: 'I do not know React.', technologies: [], highlights: [] },
  ];
  content.skillConflicts[0].negativeEvidence[0].path = 'projects[1].description';
  const record = await resume(content), reordered = currentContent(record);
  reordered.projects.reverse();
  let saved = await editing.saveContent(record._id, record.owner, { revision: 1, content: reordered });
  assert.equal(activeSkillConflicts(saved.parsedData)[0].negativeEvidence[0].path, 'projects[0].description');
  assert.equal(status(saved.parsedData), 'uncertain');
  const resolved = currentContent(saved);
  resolved.projects = resolved.projects.filter((entry) => entry.entryId !== 'course-notes'); resolved.skills.technical.push('React');
  saved = await editing.saveContent(record._id, record.owner, { revision: 2, content: resolved });
  assert.equal(activeSkillConflicts(saved.parsedData).length, 0); assert.equal(status(saved.parsedData), 'supported');
});

test('selected and scoped project snapshots relocate retained denials and clear conflicts outside their scope', () => {
  const { selectedContent, scopedContent } = require('../src/services/resumeStructure');
  const content = original(); content.summary = '';
  content.projects = [
    { entryId: 'form', title: 'Input form', description: 'Built a React form with Python validation.', technologies: ['Python'], highlights: [] },
    { entryId: 'denial', title: 'Course notes', description: 'I do not know React.', technologies: [], highlights: [] },
  ];
  content.skillConflicts[0].negativeEvidence[0].path = 'projects[1].description';
  for (const selected of [selectedContent({ parsedData: content }, { projects: ['denial'] }), scopedContent(content, 'projects:denial')]) {
    assert.equal(activeSkillConflicts(selected)[0].negativeEvidence[0].path, 'projects[0].description');
    assert.equal(status(selected), 'uncertain');
  }
  for (const selected of [selectedContent({ parsedData: content }, { projects: ['form'] }), scopedContent(content, 'projects:form')]) {
    assert.equal(activeSkillConflicts(selected).length, 0); assert.equal(status(selected), 'supported');
  }
  assert.equal(content.skillConflicts[0].negativeEvidence[0].path, 'projects[1].description', 'scoping must not mutate full source evidence');
});
