const cloudinary = require('cloudinary').v2;
const env = require('./env');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const uploadsDir = path.resolve(__dirname, '../../uploads');
const isConfigured = Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
if (isConfigured) cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME, api_key: env.CLOUDINARY_API_KEY, api_secret: env.CLOUDINARY_API_SECRET,
});
function localPath(filename) {
  if (!filename || path.basename(filename) !== filename || /[/\\]/.test(filename)) throw new Error('Invalid stored filename');
  const result = path.resolve(uploadsDir, filename);
  if (path.dirname(result) !== uploadsDir) throw new Error('Invalid upload path');
  return result;
}
async function uploadFile(fileSource, options = {}) {
  if (isConfigured) {
    try {
      const result = await new Promise((resolve, reject) => {
        const settings = { folder: 'careerforge_resumes', resource_type: 'raw', type: 'authenticated',
          public_id: options.public_id, overwrite: false };
        const callback = (error, result) => error ? reject(error) : resolve(result);
        if (Buffer.isBuffer(fileSource)) cloudinary.uploader.upload_stream(settings, callback).end(fileSource);
        else cloudinary.uploader.upload(fileSource, settings, callback);
      });
      return { ...result, storage: { provider: 'cloudinary', publicId: result.public_id,
        resourceType: result.resource_type || 'raw', deliveryType: 'authenticated', format: result.format || '' } };
    } catch (_error) { console.warn('Cloud storage upload failed; using protected local storage.'); }
  }
  await fs.mkdir(uploadsDir, { recursive: true });
  const extension = path.extname(options.filename || 'document.pdf').toLowerCase();
  const filename = 'resume_' + crypto.randomUUID() + extension;
  const target = localPath(filename);
  if (Buffer.isBuffer(fileSource)) await fs.writeFile(target, fileSource);
  else await fs.copyFile(fileSource, target);
  return { secure_url: '', public_id: filename, fallback: true,
    storage: { provider: 'local', filename } };
}
function storageFor(resume) {
  if (resume.originalFileStorage?.provider) return resume.originalFileStorage;
  // Compatibility for local originals written before private download routes existed.
  if (resume.originalFileUrl?.startsWith('/uploads/')) return {
    provider: 'local', filename: decodeURIComponent(resume.originalFileUrl.slice('/uploads/'.length)),
  };
  if (resume.originalFileUrl?.startsWith('https://res.cloudinary.com/')) {
    const url = new URL(resume.originalFileUrl);
    const [cloud, resourceType, deliveryType, ...segments] = url.pathname.slice(1).split('/');
    if (cloud === env.CLOUDINARY_CLOUD_NAME && ['image', 'raw', 'video'].includes(resourceType) &&
        ['upload', 'private', 'authenticated'].includes(deliveryType)) {
      const original = segments.filter((segment) => !/^v\d+$/.test(segment)).join('/');
      const format = resourceType === 'raw' ? '' : path.extname(original).slice(1);
      return { provider: 'cloudinary', resourceType, deliveryType, format,
        publicId: decodeURIComponent(format ? original.slice(0, -format.length - 1) : original) };
    }
  }
  return null;
}
function getOriginalDownload(resume) {
  const storage = storageFor(resume);
  if (storage?.provider === 'local') return { path: localPath(storage.filename) };
  if (storage?.provider === 'cloudinary' && isConfigured) return {
    url: cloudinary.utils.private_download_url(storage.publicId, storage.format || '', {
      resource_type: storage.resourceType || 'raw', type: storage.deliveryType || 'authenticated',
      attachment: true, expires_at: Math.floor(Date.now() / 1000) + 60,
    }),
  };
  const error = new Error('Original file is unavailable; re-upload this legacy cloud resume to use private storage');
  error.statusCode = 404;
  throw error;
}
async function deleteFile(resume) {
  const storage = storageFor(resume);
  if (storage?.provider === 'local') {
    try { await fs.unlink(localPath(storage.filename)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  } else if (storage?.provider === 'cloudinary') {
    if (!isConfigured) throw new Error('Configure cloud storage before deleting this original');
    await cloudinary.uploader.destroy(storage.publicId, { resource_type: storage.resourceType || 'raw',
      type: storage.deliveryType || 'authenticated', invalidate: true });
  }
}
module.exports = { cloudinary, isConfigured, uploadFile, getOriginalDownload, deleteFile, uploadsDir };
