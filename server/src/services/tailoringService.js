const Resume = require('../models/Resume');
const TailoredResume = require('../models/TailoredResume');
const Counter = require('../models/ResumeVersionCounter');
const generatorAgent = require('../agents/generatorAgent');
const analyzerAgent = require('../agents/analyzerAgent');
const { createJob, dispatchJob } = require('./jobService');
const { plain, resumeText } = require('../providers/resumeFacts');
const { cancellationError } = require('./jobContext');
const { improvementSuggestions } = require('../providers/resumeWriting');

class TailoringService {
  async tailorResume({ resumeId, userId, targetRole, jobDescriptionText = '', workspaceId }) {
    const resume = await require('./resumeService').getReadyResume(resumeId, userId);
    const job = await createJob({ userId, jobType: 'resume_tailor', inputRef: {
      resumeId: resume._id, workspaceId, targetRole, rawInput: { targetRole, jobDescriptionText },
    } });
    return dispatchJob(job);
  }
  async processTailoring({ job, checkpoint, commit }) {
    const existing = await TailoredResume.findOne({ processingJobId: job._id, owner: job.owner });
    if (existing) return commit(async () => { await require('./workspaceService').link(job, { $set: { latestVersionId: existing._id } }); return { tailoredResume: existing, aiProvider: existing.aiProvider }; });
    const resume = await require('./resumeService').getReadyResume(job.inputRef.resumeId, job.owner);
    let original = plain(resume.parsedData);
    const { targetRole, jobDescriptionText } = job.inputRef.rawInput;
    const recoverSource = resume.aiProvider !== 'groq' ||
      (resume.rawText?.length > 8000 && (resume.parsingInputLength || 0) < resume.rawText.length);
    if (!resume.verifiedAt && recoverSource && resume.rawText && require('../providers/providerFactory').groq.isAvailable() && resume.rawText.length <= 48000) {
      const recovered = await require('../agents/parserAgent').parse({ rawText: resume.rawText,
        jobId: job._id, userId: job.owner });
      if (recovered.aiProvider === 'groq') original = plain(recovered.parsedData);
      await checkpoint();
    }
    const tailoredData = await generatorAgent.tailorResume({ resumeData: original, targetRole, jobDescriptionText,
      jobId: job._id, userId: job.owner });
    await checkpoint();
    const complete = { ...original, summary: tailoredData.summary, skills: tailoredData.skills,
      workExperience: tailoredData.workExperience, projects: tailoredData.projects };
    const atsScore = await analyzerAgent.scoreATS({ resumeData: complete, rawText: resumeText(complete),
      jobId: job._id, userId: job.owner });
    return commit(async () => {
      if (!await Resume.exists({ _id: resume._id, owner: job.owner, deleting: { $ne: true } })) throw cancellationError();
      const latest = await TailoredResume.findOne({ resumeId: resume._id }).sort({ version: -1 }).select('version');
      try {
        await Counter.updateOne({ _id: resume._id }, { $setOnInsert: { sequence: latest?.version || 0 } }, { upsert: true });
      } catch (error) { if (error.code !== 11000) throw error; }
      const counter = await Counter.findByIdAndUpdate(resume._id, { $inc: { sequence: 1 } }, { new: true });
      const tailoredResume = await TailoredResume.create({
        processingJobId: job._id,
        workspaceId: job.inputRef.workspaceId,
        resumeId: resume._id, owner: job.owner, targetRole, jobDescriptionText, version: counter.sequence,
        tailoredContent: complete, atsScore, assessmentMeta: atsScore.assessmentMeta, diffFromOriginal: tailoredData.diffFromOriginal, aiProvider: tailoredData.aiProvider,
        improvementSuggestions: improvementSuggestions(original),
        sourceContent: original, sourceRevision: resume.contentRevision || 1,
      });
      await require('./workspaceService').link(job, { $set: { latestVersionId: tailoredResume._id } });
      return { tailoredResume, aiProvider: tailoredData.aiProvider };
    });
  }
  async getVersions(resumeId, userId) {
    await require('./resumeService').getResumeById(resumeId, userId);
    return TailoredResume.find({ resumeId, owner: userId }).sort({ version: -1 });
  }
  async getTailoredVersion(versionId, userId) {
    const tailored = await TailoredResume.findOne({ _id: versionId, owner: userId });
    if (!tailored) throw Object.assign(new Error('Tailored resume version not found'), { statusCode: 404 });
    return tailored;
  }
  async exportVersion(versionId, userId, format = 'pdf', options = {}) {
    const tailored = await this.getTailoredVersion(versionId, userId);
    const resume = await require('./resumeService').getResumeById(tailored.resumeId, userId);
    if (!['pdf', 'docx'].includes(format)) throw require('./resumeContent').fail('Unsupported export format');
    const content = plain(tailored.reviewedContent || tailored.tailoredContent);
    return { ...await require('./resumeExport')[format](content, options, resume.title), version: tailored };
  }
  async generatePdf(versionId, userId) {
    const result = await this.exportVersion(versionId, userId);
    return require('node:stream').Readable.from(result.buffer);
  }
}
module.exports = new TailoringService();
