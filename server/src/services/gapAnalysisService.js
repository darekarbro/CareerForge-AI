const Resume = require('../models/Resume');
const JobDescription = require('../models/JobDescription');
const GapAnalysis = require('../models/GapAnalysis');
const ProcessingJob = require('../models/ProcessingJob');
const analyzerAgent = require('../agents/analyzerAgent');
const { runProcessingJob } = require('./processingJobLifecycle');

class GapAnalysisService {
  async runGapAnalysis({ resumeId, userId, jobDescriptionText, targetRole, company }) {
    const resume = await Resume.findOne({ _id: resumeId, owner: userId });
    if (!resume) {
      const error = new Error('Resume not found');
      error.statusCode = 404;
      throw error;
    }

    // Create JobDescription record
    const jd = await JobDescription.create({
      owner: userId,
      rawText: jobDescriptionText,
      targetRole: targetRole || 'Software Engineer',
      company: company || 'Target Company',
      title: `${targetRole || 'Target Role'} @ ${company || 'Target Company'}`,
    });

    // Create ProcessingJob
    const processingJob = await ProcessingJob.create({
      owner: userId,
      jobType: 'gap_analysis',
      status: 'PENDING',
      inputRef: {
        resumeId: resume._id,
        jobDescriptionId: jd._id,
        targetRole: jd.targetRole,
        rawInput: {
          resumeData: resume.parsedData,
          jobDescriptionText,
          targetRole: jd.targetRole,
        },
      },
    });

    const { gapRecord } = await runProcessingJob(processingJob, async () => {
      const analysis = await analyzerAgent.analyzeGap({
        resumeData: resume.parsedData,
        jobDescriptionText,
        targetRole: jd.targetRole,
        jobId: processingJob._id,
        userId,
      });

      const createdGapRecord = await GapAnalysis.create({
        resumeId: resume._id,
        jobDescriptionId: jd._id,
        owner: userId,
        matchScore: analysis.matchScore,
        mustHaveMissing: analysis.mustHaveMissing,
        niceToHaveMissing: analysis.niceToHaveMissing,
        matchedSkills: analysis.matchedSkills,
        summaryRecommendations: analysis.summaryRecommendations,
        aiProvider: analysis.aiProvider,
      });

      return { gapRecord: createdGapRecord, aiProvider: analysis.aiProvider };
    });

    return {
      gapAnalysis: gapRecord,
      jobId: processingJob._id,
    };
  }

  async getAnalysisById(analysisId, userId) {
    const analysis = await GapAnalysis.findOne({ _id: analysisId, owner: userId })
      .populate('resumeId')
      .populate('jobDescriptionId');
    if (!analysis) {
      const error = new Error('Gap analysis report not found');
      error.statusCode = 404;
      throw error;
    }
    return analysis;
  }
}

module.exports = new GapAnalysisService();
