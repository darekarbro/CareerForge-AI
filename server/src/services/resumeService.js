const Resume = require('../models/Resume');
const TailoredResume = require('../models/TailoredResume');
const ProcessingJob = require('../models/ProcessingJob');
const ProcessingLog = require('../models/ProcessingLog');
const InterviewSession = require('../models/InterviewSession');
const InterviewQuestion = require('../models/InterviewQuestion');
const GapAnalysis = require('../models/GapAnalysis');
const JobDescription = require('../models/JobDescription');
const Notification = require('../models/Notification');
const Application = require('../models/Application');
const { uploadFile, getOriginalDownload, deleteFile } = require('../config/cloudinary');
const { createJob, dispatchJob } = require('./jobService');
const { abortJob, waitForJobs, cancellationError } = require('./jobContext');
const parserAgent = require('../agents/parserAgent');
const analyzerAgent = require('../agents/analyzerAgent');

const failure = (message, statusCode) => Object.assign(new Error(message), { statusCode });
class ResumeService {
  async listUserResumes(userId) { return Resume.find({ owner: userId, deleting: { $ne: true } }).sort({ createdAt: -1 }); }
  async getResumeById(resumeId, userId) {
    const resume = await Resume.findOne({ _id: resumeId, owner: userId, deleting: { $ne: true } });
    if (!resume) throw failure('Resume not found', 404);
    return resume;
  }
  async getReadyResume(resumeId, userId) {
    const resume = await this.getResumeById(resumeId, userId);
    const ready = resume.processingStatus === 'COMPLETED' || (!resume.processingJobId && Boolean(resume.rawText));
    if (!ready) throw failure('Wait for resume processing to complete successfully before continuing', 409);
    return resume;
  }
  async getOriginal(resumeId, userId) {
    const resume = await this.getResumeById(resumeId, userId);
    return { resume, download: getOriginalDownload(resume) };
  }
  async deleteResume(resumeId, userId) {
    const resume = await Resume.findOneAndUpdate({ _id: resumeId, owner: userId, deleting: { $ne: true } },
      { $set: { deleting: true } }, { new: true });
    if (!resume) throw failure('Resume not found', 404);
    try {
      const sessions = await InterviewSession.find({ resumeId, owner: userId }).select('_id jobDescriptionId');
      const sessionIds = sessions.map((session) => session._id);
      const jobs = await ProcessingJob.find({ owner: userId, $or: [
        { 'inputRef.resumeId': resumeId }, { 'inputRef.sessionId': { $in: sessionIds } },
      ] }).select('_id');
      const jobIds = jobs.map((job) => job._id);
      await ProcessingJob.updateMany({ _id: { $in: jobIds }, status: { $in: ['PENDING', 'RUNNING', 'RETRYING'] } },
        { $set: { status: 'CANCELLED', completedAt: new Date() }, $unset: { 'inputRef.rawInput': 1 } });
      jobIds.forEach(abortJob);
      await waitForJobs(jobIds);
      // A worker in another process may already be committing; drain it before removing derived records.
      const deadline = Date.now() + 15000;
      while (await ProcessingJob.exists({ _id: { $in: jobIds }, status: { $in: ['RUNNING', 'COMMITTING'] } })) {
        if (Date.now() > deadline) throw failure('Processing is still finishing; retry deletion shortly', 503);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      await deleteFile(resume);
      const gaps = await GapAnalysis.find({ resumeId, owner: userId }).select('jobDescriptionId');
      const versions = await TailoredResume.find({ resumeId, owner: userId }).select('jobDescriptionId');
      const descriptions = [...sessions, ...gaps, ...versions].map((record) => record.jobDescriptionId).filter(Boolean);
      await InterviewQuestion.deleteMany({ sessionId: { $in: sessionIds } });
      await InterviewSession.deleteMany({ _id: { $in: sessionIds }, owner: userId });
      await TailoredResume.deleteMany({ resumeId, owner: userId });
      await require('../models/CareerEvidence').deleteMany({ owner: userId, 'source.resumeId': resumeId });
      await require('../models/CopilotRun').deleteMany({ resumeId, owner: userId });
      await GapAnalysis.deleteMany({ resumeId, owner: userId });
      await ProcessingLog.deleteMany({ jobId: { $in: jobIds }, owner: userId });
      await Notification.deleteMany({ jobId: { $in: jobIds }, owner: userId });
      await ProcessingJob.deleteMany({ _id: { $in: jobIds }, owner: userId });
      await require('../models/JobPayload').deleteMany({ jobId: { $in: jobIds }, owner: userId });
      await require('../models/AssessmentCache').deleteMany({ owner: userId });
      await require('../models/ProductEvent').deleteMany({ resumeId, owner: userId });
      await Application.updateMany({ owner: userId, 'resumeSnapshot.resumeId': resumeId }, { $unset: { resumeVersionId: 1, resumeSnapshot: 1 } });
      await require('../models/JobWorkspace').updateMany({ owner: userId, resumeId }, { $unset: { resumeId: 1, latestVersionId: 1, latestGapId: 1 }, $pull: { interviewIds: { $in: sessionIds } }, $inc: { revision: 1 } });
      for (const id of new Set(descriptions.map(String))) {
        const shared = await GapAnalysis.exists({ jobDescriptionId: id }) ||
          await TailoredResume.exists({ jobDescriptionId: id }) || await InterviewSession.exists({ jobDescriptionId: id }) ||
          await ProcessingJob.exists({ 'inputRef.jobDescriptionId': id, status: { $in: ['PENDING', 'RUNNING', 'COMMITTING'] } }) ||
          await require('../models/JobWorkspace').exists({ owner: userId, jobDescriptionId: id });
        if (!shared) await JobDescription.deleteOne({ _id: id, owner: userId });
      }
      await Resume.deleteOne({ _id: resumeId, owner: userId });
      await require('../models/ResumeVersionCounter').deleteOne({ _id: resumeId });
      return { success: true, message: 'Resume and its associated private files and processing data were deleted' };
    } catch (error) {
      await Resume.updateOne({ _id: resumeId, owner: userId }, { $set: { deleting: false } });
      throw error;
    }
  }
  async uploadAndProcessResume({ file, userId, title }) {
    const account = await require('../models/User').findOne({ _id: userId, deleting: { $ne: true } });
    if (!account) throw failure('Account unavailable', 401);
    if (!account.emailVerifiedAt) throw Object.assign(failure('Verify your email before starting AI processing', 403), { code: 'EMAIL_UNVERIFIED' });
    const fileType = file.originalname.split('.').pop().toLowerCase();
    if (!['pdf', 'docx', 'txt'].includes(fileType)) throw failure('Unsupported resume file type', 415);
    const upload = await uploadFile(file.buffer, { filename: file.originalname,
      public_id: 'resume_' + userId + '_' + require('node:crypto').randomUUID() });
    let resume;
    try {
      resume = await Resume.create({ owner: userId, title: title || file.originalname.replace(/\.[^/.]+$/, ''),
        originalFileName: file.originalname, originalFileStorage: upload.storage, fileType, processingStatus: 'PENDING' });
    } catch (error) { await deleteFile({ originalFileStorage: upload.storage }); throw error; }
    let job;
    try { job = await createJob({ userId, jobType: 'resume_parse', inputRef: { resumeId: resume._id,
      rawInput: { fileBuffer: file.buffer.toString('base64'), fileType } } }); }
    catch (error) { await deleteFile(resume); await Resume.deleteOne({ _id: resume._id }); throw error; }
    resume.processingJobId = job._id;
    resume.originalFileUrl = '/api/resumes/' + resume._id + '/original';
    await resume.save();
    try { await dispatchJob(job); }
    catch (error) { await Resume.updateOne({ _id: resume._id }, { $set: { processingStatus: 'FAILED' } }); throw error; }
    return { resume, jobId: job._id };
  }
  async processUpload({ job, checkpoint, commit }) {
    const existing = await Resume.findOne({ _id: job.inputRef.resumeId, owner: job.owner, processingJobId: job._id, processingStatus: 'COMPLETED', deleting: { $ne: true } });
    if (existing) return commit(async () => ({ resume: existing, aiProvider: existing.aiProvider }));
    const { fileBuffer, fileType } = job.inputRef.rawInput || {};
    const parsed = await parserAgent.parse({ fileBuffer: Buffer.from(fileBuffer, 'base64'), fileType,
      jobId: job._id, userId: job.owner });
    await checkpoint();
    const atsScore = await analyzerAgent.scoreATS({ resumeData: parsed.parsedData, rawText: parsed.rawText,
      jobId: job._id, userId: job.owner });
    return commit(async () => {
      const resume = await Resume.findOneAndUpdate({ _id: job.inputRef.resumeId, owner: job.owner, deleting: { $ne: true } }, {
        $set: { rawText: parsed.rawText, sourceText: parsed.rawText.length <= 48000 ? parsed.rawText : '', parsedData: require('./resumeStructure').withEntryIds(parsed.parsedData), atsScore, assessmentMeta: atsScore.assessmentMeta, processingStatus: 'COMPLETED',
          aiProvider: parsed.aiProvider, parsingWarnings: parsed.parsedData.warnings || [], parsingInputLength: parsed.inputCharacters },
      }, { new: true, runValidators: true });
      if (!resume) throw cancellationError();
      return { resume, aiProvider: parsed.aiProvider };
    });
  }
  async getDashboardMetrics(userId) {
    const [resumes, tailoredCount, sessions, applications, workspaces, profile, exports, firstExport, account] = await Promise.all([
      Resume.find({ owner: userId, deleting: { $ne: true } }).sort({ createdAt: -1 }),
      TailoredResume.countDocuments({ owner: userId }),
      InterviewSession.find({ owner: userId, status: 'completed' }).sort({ completedAt: -1 }),
      Application.find({ owner: userId }).sort({ createdAt: -1 }),
      require('../models/JobWorkspace').find({ owner: userId }).sort({ updatedAt: -1 }),
      require('../models/CareerProfile').findOne({ owner: userId }),
      require('../models/ProductEvent').countDocuments({ owner: userId }),
      require('../models/ProductEvent').findOne({ owner: userId }).sort({ createdAt: 1 }),
      require('../models/User').findById(userId).select('createdAt'),
    ]);
    const ready = resumes.filter((resume) => resume.processingStatus === 'COMPLETED');
    const average = (list, value) => list.length ? Math.round(list.reduce((sum, item) => sum + value(item), 0) / list.length) : 0;
    const applicationFunnel = Object.fromEntries(['saved', 'applied', 'oa', 'interview', 'offer', 'rejected']
      .map((status) => [status, applications.filter((app) => app.status === status).length]));
    applicationFunnel.total = applications.length;
    return {
      totalWorkspaces: workspaces.length, totalExports: exports,
      firstExportMinutes: firstExport && account ? Math.max(0, Math.round((firstExport.createdAt - account.createdAt) / 60000)) : null,
      verifiedResumeCount: ready.filter((item) => item.verifiedAt).length,
      profileCompleted: Boolean(profile?.onboardingCompleted),
      nextResume: ready.find((item) => !item.verifiedAt)?._id || ready[0]?._id,
      nextWorkspace: workspaces[0]?._id,
      dueApplications: applications.filter((item) => !['offer', 'rejected'].includes(item.status) && [item.deadline, item.followUpAt].some((date) => date && new Date(date) <= new Date(Date.now() + 3 * 86400000))).slice(0, 5),
      totalResumes: resumes.length, totalTailored: tailoredCount,
      avgAtsScore: average(ready.filter((item) => !item.atsScoreStale && item.assessmentMeta), (resume) => resume.atsScore?.score || 0),
      avgInterviewScore: average(sessions, (session) => session.overallScore || 0),
      completedInterviewCount: sessions.length,
      interviewTrends: sessions.slice(0, 10).reverse().map((session, index) => ({
        session: 'S' + (index + 1), date: session.completedAt?.toISOString(), role: session.targetRole, score: session.overallScore,
      })),
      applicationFunnel, recentResumes: resumes.slice(0, 5), recentApplications: applications.slice(0, 5),
    };
  }
  async getAtsScore(resumeId, userId) { return (await this.getReadyResume(resumeId, userId)).atsScore; }
}
module.exports = new ResumeService();
