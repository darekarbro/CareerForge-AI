const JobDescription = require('../models/JobDescription');
const GapAnalysis = require('../models/GapAnalysis');
const analyzerAgent = require('../agents/analyzerAgent');
const { createJob, dispatchJob } = require('./jobService');
const { plain } = require('../providers/resumeFacts');

class GapAnalysisService {
  async runGapAnalysis({ resumeId, userId, jobDescriptionText, targetRole = 'Software Engineer', company = '', workspaceId, jobDescriptionId }) {
    const resume = await require('./resumeService').getReadyResume(resumeId, userId);
    const job = await createJob({ userId, jobType: 'gap_analysis', inputRef: {
      resumeId: resume._id, workspaceId, jobDescriptionId, targetRole, rawInput: { jobDescriptionText, targetRole, company },
    } });
    return dispatchJob(job);
  }
  async processAnalysis({ job, checkpoint, commit }) {
    const existing = await GapAnalysis.findOne({ processingJobId: job._id, owner: job.owner });
    if (existing) return commit(async () => { await require('./workspaceService').link(job, { $set: { latestGapId: existing._id } }); return { gapAnalysis: existing, aiProvider: existing.aiProvider }; });
    const resume = await require('./resumeService').getReadyResume(job.inputRef.resumeId, job.owner);
    const { jobDescriptionText, targetRole, company } = job.inputRef.rawInput;
    const analysis = await analyzerAgent.analyzeGap({ resumeData: plain(resume.parsedData), jobDescriptionText, targetRole,
      jobId: job._id, userId: job.owner });
    await checkpoint();
    return commit(async () => {
      const jd = job.inputRef.jobDescriptionId ? await JobDescription.findOne({ _id: job.inputRef.jobDescriptionId, owner: job.owner }) : await JobDescription.findOneAndUpdate({ processingJobId: job._id, owner: job.owner }, { $setOnInsert: { owner: job.owner, rawText: jobDescriptionText, targetRole,
        company, title: targetRole + (company ? ' @ ' + company : '') } }, { upsert: true, new: true });
      if (!jd) throw Object.assign(new Error('Job description no longer available'), { statusCode: 404 });
      try {
        const gapAnalysis = await GapAnalysis.create({ ...analysis, processingJobId: job._id, owner: job.owner, resumeId: resume._id,
          jobDescriptionId: jd._id });
        await require('./workspaceService').link(job, { $set: { latestGapId: gapAnalysis._id } });
        return { gapAnalysis, aiProvider: analysis.aiProvider };
      } catch (error) { if (!job.inputRef.jobDescriptionId) await JobDescription.deleteOne({ _id: jd._id }); throw error; }
    });
  }
  async getAnalysisById(analysisId, userId) {
    const analysis = await GapAnalysis.findOne({ _id: analysisId, owner: userId }).populate('resumeId').populate('jobDescriptionId');
    if (!analysis) throw Object.assign(new Error('Gap analysis report not found'), { statusCode: 404 });
    return analysis;
  }
}
module.exports = new GapAnalysisService();
