// Maintenance-only logical backup. Callers must quiesce writers before capture.
// The restore target must be empty. Archives contain private data: restrict access.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { BSON } = require('mongoose').mongo;
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const safe = (directory, filename) => {
  if (!/^[a-zA-Z0-9_.-]+$/.test(filename) || filename === '..') throw new Error('Invalid backup filename');
  const target = path.resolve(directory, filename);
  if (path.dirname(target) !== path.resolve(directory)) throw new Error('Backup path escaped destination');
  return target;
};
async function capture(db, originals, directory) {
  await fs.mkdir(directory, { recursive: true });
  if ((await fs.readdir(directory)).length) throw new Error('Backup destination must be empty');
  const manifest = { version: 1, capturedAt: new Date().toISOString(), collections: [], files: [] };
  for (const { name } of await db.listCollections().toArray()) {
    if (name.startsWith('system.')) continue;
    const documents = await db.collection(name).find().toArray();
    const bytes = Buffer.from(BSON.EJSON.stringify(documents, { relaxed: false }));
    const filename = name + '.ejson'; await fs.writeFile(safe(directory, filename), bytes, { mode: 0o600 });
    const indexes = await db.collection(name).indexes();
    manifest.collections.push({ name, filename, count: documents.length, sha256: hash(bytes), indexes });
  }
  await fs.mkdir(path.join(directory, 'originals'));
  for (const name of await fs.readdir(originals)) {
    const bytes = await fs.readFile(safe(originals, name));
    await fs.writeFile(safe(path.join(directory, 'originals'), name), bytes, { mode: 0o600 });
    manifest.files.push({ name, sha256: hash(bytes), bytes: bytes.length });
  }
  await fs.writeFile(path.join(directory, 'manifest.json'), JSON.stringify(manifest, null, 2), { mode: 0o600 });
  return manifest;
}
async function restore(db, originals, directory) {
  if ((await db.listCollections().toArray()).length) throw new Error('Restore target database must be empty');
  await fs.mkdir(originals, { recursive: true });
  if ((await fs.readdir(originals)).length) throw new Error('Restore original-files directory must be empty');
  const manifest = JSON.parse(await fs.readFile(path.join(directory, 'manifest.json'), 'utf8'));
  if (manifest.version !== 1) throw new Error('Unsupported backup version');
  // Validate the complete archive before making any writes.
  const collections = [], files = [];
  for (const entry of manifest.collections) {
    safe(directory, entry.name);
    const bytes = await fs.readFile(safe(directory, entry.filename));
    if (hash(bytes) !== entry.sha256) throw new Error('Backup checksum failed');
    const documents = BSON.EJSON.parse(bytes.toString(), { relaxed: false });
    if (documents.length !== entry.count) throw new Error('Backup count failed');
    collections.push({ entry, documents });
  }
  for (const entry of manifest.files) {
    const bytes = await fs.readFile(safe(path.join(directory, 'originals'), entry.name));
    if (hash(bytes) !== entry.sha256 || bytes.length !== entry.bytes) throw new Error('Original checksum failed');
    files.push({ entry, bytes });
  }
  for (const { entry, documents } of collections) {
    await db.createCollection(entry.name);
    if (documents.length) await db.collection(entry.name).insertMany(documents);
    for (const { key, ...options } of entry.indexes) {
      if (options.name === '_id_') continue;
      delete options.v; delete options.ns;
      await db.collection(entry.name).createIndex(key, options);
    }
  }
  for (const { entry, bytes } of files) await fs.writeFile(safe(originals, entry.name), bytes, { mode: 0o600 });
  // Restoring old sessions must never silently resurrect access.
  await db.collection('authsessions').deleteMany({});
  return manifest;
}
module.exports = { capture, restore };
