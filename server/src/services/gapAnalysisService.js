const JobDescription = require('../models/JobDescription');
const GapAnalysis = require('../models/GapAnalysis');
const analyzerAgent = require('../agents/analyzerAgent');
const { createJob, dispatchJob } = require('./jobService');
const { plain } = require('../providers/resumeFacts');

class GapAnalysisService {
  async runGapAnalysis({ resumeId, userId, jobDescriptionText, targetRole = 'Software Engineer', company = '', workspaceId, jobDescriptionId, workspaceRevision, resumeSelection }) {
    const resume = await require('./resumeService').getReadyResume(resumeId, userId);
    const job = await createJob({ userId, jobType: 'gap_analysis', inputRef: {
      resumeId: resume._id, workspaceId, workspaceRevision, jobDescriptionId, targetRole, rawInput: { jobDescriptionText, targetRole, company, ...(workspaceId || resumeSelection ? { sourceSnapshot: require('./resumeStructure').selectedContent(resume, resumeSelection), sourceRevision: resume.contentRevision || 1 } : {}) },
    } });
    return dispatchJob(job);
  }
  async processAnalysis({ job, checkpoint, commit }) {
    const existing = await GapAnalysis.findOne({ processingJobId: job._id, owner: job.owner });
    if (existing) return commit(async () => { await require('./workspaceService').link(job, { $set: { latestGapId: existing._id } }); return { gapAnalysis: existing, aiProvider: existing.aiProvider }; });
    const resume = await require('./resumeService').getReadyResume(job.inputRef.resumeId, job.owner);
    const { jobDescriptionText, targetRole, company } = job.inputRef.rawInput;
    // A selected-content snapshot belongs to the dispatch revision, even if the
    // underlying resume was edited while queued. Legacy snapshots stay unknown.
    const sourceRevision = job.inputRef.rawInput.sourceSnapshot
      ? job.inputRef.rawInput.sourceRevision : resume.contentRevision || 1;
    const analysis = await analyzerAgent.analyzeGap({ resumeData: job.inputRef.rawInput.sourceSnapshot || plain(resume.parsedData), jobDescriptionText, targetRole,
      jobId: job._id, userId: job.owner });
    await checkpoint();
    return commit(async () => {
      const jd = job.inputRef.jobDescriptionId ? await JobDescription.findOne({ _id: job.inputRef.jobDescriptionId, owner: job.owner }) : await JobDescription.findOneAndUpdate({ processingJobId: job._id, owner: job.owner }, { $setOnInsert: { owner: job.owner, rawText: jobDescriptionText, targetRole,
        company, title: targetRole + (company ? ' @ ' + company : ''), parsedRequirements: analysis.requirements } }, { upsert: true, new: true });
      if (!jd) throw Object.assign(new Error('Job description no longer available'), { statusCode: 404 });
      if (jd.rawText === jobDescriptionText) await JobDescription.updateOne({ _id: jd._id, owner: job.owner, rawText: jobDescriptionText }, { $set: { parsedRequirements: analysis.requirements } });
      try {
        const gapAnalysis = await GapAnalysis.create({ ...analysis, processingJobId: job._id, owner: job.owner, resumeId: resume._id,
          jobDescriptionId: jd._id, sourceRevision });
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
