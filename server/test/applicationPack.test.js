const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const pack = require('../src/services/applicationPackService');
const Resume = require('../src/models/Resume');
const Workspace = require('../src/models/JobWorkspace');
let db;
before(async () => {
  const binaryPath = path.resolve(__dirname, '../node_modules/.cache/mongodb-memory-server/mongod-x64-win32-7.0.24.exe');
  const binary = process.env.MONGOMS_SYSTEM_BINARY ? { systemBinary: process.env.MONGOMS_SYSTEM_BINARY } : await fs.stat(binaryPath).then(() => ({ systemBinary: binaryPath }), () => ({}));
  db = await MongoMemoryServer.create({ binary });
  await mongoose.connect(db.getUri());
});
after(async () => { await mongoose.disconnect(); await db?.stop(); });

test('preparation pack uses selected confirmed evidence, persists reviewed drafts, rejects stale/conflicting writes and scopes access', async () => {
  const owner = new mongoose.Types.ObjectId(), other = new mongoose.Types.ObjectId();
  const resume = await Resume.create({ owner, title: 'Selected resume', processingStatus: 'COMPLETED', verifiedAt: new Date(), parsedData: {
    contactInfo: { name: 'Actual Candidate' }, skills: { all: ['Python'] }, workExperience: [], projects: [
      { entryId: 'include', title: 'Validator', description: 'Built Python validation for 12 users.', technologies: ['Python'], highlights: [] },
      { entryId: 'exclude', title: 'Excluded Kubernetes', description: 'Deployed Kubernetes for 500 users.', technologies: ['Kubernetes'], highlights: [] },
    ],
  } });
  const workspace = await Workspace.create({ owner, company: 'Example', title: 'Python Engineer', description: 'Python and SQL required.', resumeId: resume._id, resumeSelection: { projects: ['include'], workExperience: [] } });
  let state = await pack.generate(workspace._id, owner);
  assert.equal(state.stale, false);
  assert.equal(state.pack.snapshot.projects.length, 1);
  assert(state.pack.drafts.coverLetter.includes('12 users'));
  assert(!state.pack.drafts.coverLetter.includes('500'));
  assert(!state.pack.drafts.coverLetter.includes('Kubernetes'));
  assert.equal(state.pack.snapshot.topics.find((topic) => topic.title === 'SQL').supported, false);
  await assert.rejects(pack.view(workspace._id, other), { statusCode: 404 });
  await assert.rejects(pack.download(workspace._id, owner), { statusCode: 409 });
  await assert.rejects(pack.save(workspace._id, owner, { revision: state.pack.revision, kind: 'coverLetter', body: state.pack.drafts.coverLetter, reviewed: true }), /Confirm/);
  await assert.rejects(pack.save(workspace._id, owner, { revision: state.pack.revision, kind: 'coverLetter', body: 'I led 700 engineers.', reviewed: true, confirmed: true }), /unsupported/);
  const oldRevision = state.pack.revision;
  state = await pack.save(workspace._id, owner, { revision: oldRevision, kind: 'coverLetter', body: state.pack.drafts.coverLetter, reviewed: true, confirmed: true });
  await assert.rejects(pack.save(workspace._id, owner, { revision: oldRevision, kind: 'coverLetter', body: state.pack.drafts.coverLetter, reviewed: false }), { statusCode: 409 });
  const exported = await pack.download(workspace._id, owner);
  assert(exported.includes('Selected resume: Selected resume'));
  assert(exported.includes('Preparation checklist'));
  assert(exported.includes('Evidence citations'));
  assert(!exported.includes('Excluded Kubernetes'));
  state = await pack.save(workspace._id, owner, { revision: state.pack.revision, kind: 'coverLetter', body: state.pack.drafts.coverLetter + '\nThank you.', reviewed: false });
  assert(!state.pack.reviewed.includes('coverLetter'));
  const evidence = await require('../src/models/CareerEvidence').findOne({ owner, kind: 'project', 'context.entryId': 'include' });
  await require('../src/models/CareerEvidence').updateOne({ _id: evidence._id }, { $set: { verification: 'rejected' }, $inc: { revision: 1 } });
  assert.equal((await pack.view(workspace._id, owner)).stale, true);
  await assert.rejects(pack.download(workspace._id, owner), { statusCode: 409 });
  state = await pack.generate(workspace._id, owner, { revision: state.pack.revision });
  assert(!state.pack.drafts.coverLetter.includes('12 users'));
  assert.deepEqual(state.pack.reviewed, []);
});

test('unverified selected resume facts appear in the pack but are withheld from outreach', async () => {
  const owner = new mongoose.Types.ObjectId();
  const resume = await Resume.create({ owner, processingStatus: 'COMPLETED', parsedData: { contactInfo: { name: 'Candidate' }, projects: [{ entryId: 'a', title: 'Unconfirmed', description: 'Built Python services.' }] } });
  const workspace = await Workspace.create({ owner, company: 'Example', title: 'Engineer', description: 'Python services', resumeId: resume._id });
  const result = await pack.generate(workspace._id, owner);
  assert.equal(result.pack.snapshot.resumeVerified, false);
  assert.equal(result.pack.snapshot.evidence.length, 0);
  assert(!result.pack.drafts.recruiter.includes('Built Python services'));
  await assert.rejects(pack.save(workspace._id, owner, { revision: result.pack.revision, kind: 'coverLetter', body: result.pack.drafts.coverLetter, reviewed: true, confirmed: true }), /placeholders/);
});
