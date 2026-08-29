const Resume = require('../models/Resume');
const TailoredResume = require('../models/TailoredResume');
const ProcessingJob = require('../models/ProcessingJob');
const InterviewSession = require('../models/InterviewSession');
const Application = require('../models/Application');
const { uploadFile } = require('../config/cloudinary');
const { enqueueJob } = require('../queues/processingQueue');
const parserAgent = require('../agents/parserAgent');
const analyzerAgent = require('../agents/analyzerAgent');

class ResumeService {
  async listUserResumes(userId) {
    return Resume.find({ owner: userId }).sort({ createdAt: -1 });
  }

  async getResumeById(resumeId, userId) {
    const resume = await Resume.findOne({ _id: resumeId, owner: userId });
    if (!resume) {
      const error = new Error('Resume not found');
      error.statusCode = 404;
      throw error;
    }
    return resume;
  }

  async deleteResume(resumeId, userId) {
    const resume = await Resume.findOneAndDelete({ _id: resumeId, owner: userId });
    if (!resume) {
      const error = new Error('Resume not found');
      error.statusCode = 404;
      throw error;
    }
    // Clean up related tailored versions
    await TailoredResume.deleteMany({ resumeId });
    return { success: true, message: 'Resume deleted successfully' };
  }

  async uploadAndProcessResume({ file, userId, title }) {
    const fileType = file.originalname.split('.').pop().toLowerCase();
    
    // 1. Upload to Cloudinary (or local fallback)
    const uploadResult = await uploadFile(file.buffer, {
      filename: file.originalname,
      public_id: `resume_${userId}_${Date.now()}`,
    });

    // 2. Create initial Resume record in DB
    const resume = await Resume.create({
      owner: userId,
      title: title || file.originalname.replace(/\.[^/.]+$/, ''),
      originalFileName: file.originalname,
      originalFileUrl: uploadResult.secure_url,
      fileType: fileType === 'docx' ? 'docx' : fileType === 'txt' ? 'txt' : 'pdf',
      parsedData: {},
      atsScore: { score: 0 },
    });

    // 3. Create ProcessingJob record
    const processingJob = await ProcessingJob.create({
      owner: userId,
      jobType: 'resume_parse',
      status: 'PENDING',
      inputRef: {
        resumeId: resume._id,
        rawInput: {
          fileBuffer: file.buffer.toString('base64'),
          fileType,
        },
      },
    });

    // 4. Enqueue background processing job
    await enqueueJob('resume_parse', { jobId: processingJob._id });

    // Also run quick synchronous parse fallback if background queue hasn't picked it up yet
    setImmediate(async () => {
      try {
        const completedJob = await ProcessingJob.findById(processingJob._id);
        if (completedJob && completedJob.status === 'COMPLETED' && completedJob.output) {
          await Resume.findByIdAndUpdate(resume._id, {
            rawText: completedJob.output.rawText,
            parsedData: completedJob.output.parsedData,
            atsScore: completedJob.output.atsScore,
          });
        }
      } catch (err) {
        console.error('Error updating resume from completed job:', err.message);
      }
    });

    return {
      resume,
      jobId: processingJob._id,
    };
  }

  async getDashboardMetrics(userId) {
    const resumes = await Resume.find({ owner: userId });
    const tailoredResumes = await TailoredResume.find({ owner: userId });
    const interviewSessions = await InterviewSession.find({ owner: userId }).sort({ createdAt: -1 });
    const applications = await Application.find({ owner: userId });

    const totalResumes = resumes.length;
    const avgAtsScore = totalResumes > 0
      ? Math.round(resumes.reduce((acc, r) => acc + (r.atsScore?.score || 0), 0) / totalResumes)
      : 0;

    const completedSessions = interviewSessions.filter(s => s.status === 'completed');
    const avgInterviewScore = completedSessions.length > 0
      ? Math.round(completedSessions.reduce((acc, s) => acc + (s.overallScore || 0), 0) / completedSessions.length)
      : 0;

    const interviewTrends = interviewSessions.slice(0, 10).reverse().map((s, idx) => ({
      session: `S${idx + 1}`,
      date: s.createdAt.toLocaleDateString(),
      role: s.targetRole,
      score: s.overallScore || 0,
    }));

    const applicationFunnel = {
      saved: applications.filter(a => a.status === 'saved').length,
      applied: applications.filter(a => a.status === 'applied').length,
      oa: applications.filter(a => a.status === 'oa').length,
      interview: applications.filter(a => a.status === 'interview').length,
      offer: applications.filter(a => a.status === 'offer').length,
      rejected: applications.filter(a => a.status === 'rejected').length,
      total: applications.length,
    };

    return {
      totalResumes,
      totalTailored: tailoredResumes.length,
      avgAtsScore,
      avgInterviewScore,
      interviewTrends,
      applicationFunnel,
      recentResumes: resumes.slice(0, 5),
      recentApplications: applications.slice(0, 5),
    };
  }

  async getAtsScore(resumeId, userId) {
    const resume = await this.getResumeById(resumeId, userId);
    
    // Recompute if atsScore is 0
    if (!resume.atsScore?.score || resume.atsScore.score === 0) {
      const ats = await analyzerAgent.scoreATS({
        resumeData: resume.parsedData,
        rawText: resume.rawText,
        userId,
      });
      resume.atsScore = ats;
      await resume.save();
    }

    return resume.atsScore;
  }
}

module.exports = new ResumeService();
