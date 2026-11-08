const Application = require('../models/Application');
const { fail, revision } = require('./resumeContent');
const path = require('node:path');
async function add(id, owner, input, file) {
  if (!file?.buffer?.length) throw fail('Choose a PDF, DOCX or TXT attachment');
  if (file.buffer.length > 2 * 1024 * 1024) throw fail('Attachments must be 2 MB or smaller', 413);
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = { '.pdf': 'application/pdf', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.txt': 'text/plain' }[ext];
  if (!mime) throw fail('Choose a PDF, DOCX or TXT attachment');
  const name = file.originalname.replace(/[^\p{L}\p{N} ._-]/gu, '_').slice(0, 120);
  const app = await Application.findOneAndUpdate({ _id: id, owner, revision: revision(Number(input.revision)), 'attachments.4': { $exists: false } }, {
    $push: { attachments: { name, mime, bytes: file.buffer.length, data: file.buffer, uploadedAt: new Date() }, timeline: { status: 'attachment', note: 'Added attachment: ' + name, updatedAt: new Date() } },
    $inc: { revision: 1, __v: 1 }, $set: { lastUpdated: new Date() },
  }, { new: true, runValidators: true });
  if (!app) { if (!await Application.exists({ _id: id, owner })) throw fail('Application not found', 404); throw fail('Application changed or has five attachments. Reload before uploading.', 409); }
  for (const attachment of app.attachments) attachment.data = undefined;
  return app;
}
async function get(id, owner, attachmentId) {
  const app = await Application.findOne({ _id: id, owner }).select('+attachments.data');
  const file = app?.attachments.id(attachmentId);
  if (!file?.data) throw fail('Attachment not found', 404);
  return file;
}
async function remove(id, owner, attachmentId, input) {
  const app = await Application.findOneAndUpdate({ _id: id, owner, revision: revision(input.revision), 'attachments._id': attachmentId }, {
    $pull: { attachments: { _id: attachmentId } }, $push: { timeline: { status: 'attachment', note: 'Removed an attachment', updatedAt: new Date() } },
    $inc: { revision: 1, __v: 1 }, $set: { lastUpdated: new Date() },
  }, { new: true });
  if (!app) { if (!await Application.exists({ _id: id, owner })) throw fail('Application not found', 404); throw fail('Attachment missing or application changed. Reload before removing.', 409); }
  return app;
}
module.exports = { add, get, remove };
