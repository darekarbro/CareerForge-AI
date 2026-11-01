const { test } = require('node:test'), assert = require('node:assert/strict');
test('Main audit: mandatory contribution questions precede optional outcome questions', () => {
  const projects = Array.from({ length: 10 }, (_, index) => ({ entryId: 'project-' + index, title: 'Project ' + index, description: 'I implemented Python input validation and tested malformed course data before accepting imports.', highlights: [] }));
  const result = require('../src/services/copilotService').questions({ projects, workExperience: [{ entryId: 'needs-detail', role: 'Engineer', company: 'Example', highlights: ['Helped a project.'] }] });
  assert.equal(result.length, 8); assert.equal(result[0].required, true); assert.equal(result[0].context.entryId, 'needs-detail');
});
test('Main audit: evidence collection retains uncategorized skills without duplicate aliases', () => {
  const facts = require('../src/services/evidenceService').facts({ skills: { technical: ['React'], all: ['React.js', 'Rust'] } });
  assert.deepEqual(facts.map((item) => item.statement), ['React', 'Rust']);
});
test('Main audit: configured production cloud failures never fall back to an ephemeral local original', async () => {
  const env = require('../src/config/env'), cloud = require('cloudinary').v2, fs = require('node:fs/promises');
  const old = { NODE_ENV: env.NODE_ENV, CLOUDINARY_CLOUD_NAME: env.CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY: env.CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET: env.CLOUDINARY_API_SECRET };
  const modulePath = require.resolve('../src/config/cloudinary'), cached = require.cache[modulePath], upload = cloud.uploader.upload_stream;
  Object.assign(env, { NODE_ENV: 'production', CLOUDINARY_CLOUD_NAME: 'synthetic-cloud', CLOUDINARY_API_KEY: 'synthetic-key', CLOUDINARY_API_SECRET: 'synthetic-secret' }); delete require.cache[modulePath];
  cloud.uploader.upload_stream = (_options, callback) => ({ end: () => callback(new Error('fake-provider-secret')) });
  try {
    const storage = require(modulePath), before = await fs.readdir(storage.uploadsDir).catch(() => []);
    await assert.rejects(storage.uploadFile(Buffer.from('Fictional resume'), { filename: 'synthetic.txt' }), (error) => error.statusCode === 503 && !error.message.includes('fake-provider-secret'));
    assert.deepEqual(await fs.readdir(storage.uploadsDir).catch(() => []), before);
  } finally { Object.assign(env, old); cloud.uploader.upload_stream = upload; if (cached) require.cache[modulePath] = cached; else delete require.cache[modulePath]; }
});
