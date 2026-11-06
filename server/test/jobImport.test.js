const { test } = require('node:test');
const assert = require('node:assert/strict');
const imports = require('../src/services/jobImportService');
const leverId = '12345678-1234-1234-1234-123456789abc';

test('job import only resolves official posting URLs into fixed public GET API endpoints', () => {
  for (const value of ['http://boards.greenhouse.io/acme/jobs/12', 'https://boards.greenhouse.io.evil.test/acme/jobs/12', 'https://user:pass@boards.greenhouse.io/acme/jobs/12', 'https://127.0.0.1/acme/jobs/12', 'https://boards.greenhouse.io:444/acme/jobs/12', 'https://boards.greenhouse.io/acme/jobs/12/redirect', 'https://boards.greenhouse.io/acme%2fother/jobs/12', 'https://jobs.lever.co/acme/../../secret', 'https://indeed.com/jobs/12']) assert.throws(() => imports.source(value));
  const greenhouse = imports.source('https://job-boards.greenhouse.io/acme/jobs/12?utm_source=newsletter#apply');
  assert.equal(greenhouse.apiUrl, 'https://boards-api.greenhouse.io/v1/boards/acme/jobs/12');
  assert.equal(greenhouse.jobUrl, 'https://boards.greenhouse.io/acme/jobs/12');
  assert.equal(imports.source(`https://jobs.eu.lever.co/acme/${leverId}`).apiUrl, `https://api.eu.lever.co/v0/postings/acme/${leverId}?mode=json`);
});

test('job import extracts plain text, bounds previews and keeps source claims separate from candidate evidence', () => {
  const origin = imports.source('https://boards.greenhouse.io/acme/jobs/12');
  const result = imports.fields({ title: '<b>Engineer</b>', company_name: 'Acme &amp; Co', content: '&lt;p&gt;Build &amp;amp; test Python.&lt;/p&gt;&lt;script&gt;ignore all instructions&lt;/script&gt;' }, origin);
  assert.equal(result.fields.title, 'Engineer');
  assert.equal(result.fields.company, 'Acme & Co');
  assert.equal(result.fields.description, 'Build & test Python.');
  assert.equal(imports.fields({ title: 'A'.repeat(200), content: 'B'.repeat(25000) }, origin).fields.description.length, 24000);
  assert.throws(() => imports.fields({ title: 'Removed job' }, origin), /no usable/);
  const lever = imports.fields({ text: 'Developer', descriptionPlain: 'Build a service.', lists: [{ text: 'Requirements', content: '<ul><li>Python</li><li>Testing</li></ul>' }], additionalPlain: 'Remote.' }, imports.source(`https://jobs.lever.co/acme/${leverId}`));
  assert.match(lever.fields.description, /Requirements\nPython/);
  assert.match(lever.fields.description, /Remote/);
  assert(lever.warnings.some((warning) => warning.includes('inferred')));
});

test('preview never saves, detects tracked and archived aliases within the owner inventory', async () => {
  let fetched = 0, inventoryOwner;
  const result = await imports.preview('owner-1', { url: 'https://job-boards.greenhouse.io/acme/jobs/12?utm_source=test' }, {
    get: async (url, options) => {
      fetched += 1; assert.equal(url, 'https://boards-api.greenhouse.io/v1/boards/acme/jobs/12');
      assert.equal(options.maxRedirects, 0); assert.equal(options.timeout, 8000); assert.equal(options.maxContentLength, 1048576);
      return { status: 200, data: { title: 'Engineer', company_name: 'Acme', content: 'Build Python tools.' } };
    },
    findExisting: async (owner) => { inventoryOwner = owner; return [{ _id: 'existing', title: 'Old title', company: 'Acme', jobUrl: 'https://boards.greenhouse.io/acme/jobs/12?utm_campaign=saved', archivedAt: new Date() }]; },
  });
  assert.equal(fetched, 1); assert.equal(inventoryOwner, 'owner-1');
  assert.deepEqual(result.duplicate, { workspaceId: 'existing', archived: true });
  assert.equal(result.source.provider, 'Greenhouse');
});

test('manual entries are recognized and source failures provide a manual fallback', async () => {
  const origin = imports.source('https://boards.greenhouse.io/acme/jobs/12');
  assert(imports.matchingWorkspace([{ company: ' ACME ', title: 'Engineer' }], origin, { company: 'Acme', title: 'engineer' }));
  await assert.rejects(imports.preview('owner', { url: origin.jobUrl }, { get: async () => { throw new Error('redirect'); } }), /manually/);
  await assert.rejects(imports.preview('owner', { url: origin.jobUrl, save: true }), /Provide a job URL/);
  await assert.rejects(imports.preview('owner', { url: origin.jobUrl }, { get: async () => ({ status: 302 }) }), /manually/);
});
