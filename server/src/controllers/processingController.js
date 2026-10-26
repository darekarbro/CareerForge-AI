const ProcessingJob = require('../models/ProcessingJob');
const ProcessingLog = require('../models/ProcessingLog');
const providerFactory = require('../providers/providerFactory');
const { abortJob } = require('../services/jobContext');
const Resume = require('../models/Resume');
const InterviewQuestion = require('../models/InterviewQuestion');

const getJobStatus = async (req, res, next) => {
  try {
    const job = await ProcessingJob.findOne({ _id: req.params.id, owner: req.user._id });
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Processing job not found',
      });
    }

    res.status(200).json({
      success: true,
      data: job,
    });
  } catch (err) {
    next(err);
  }
};

const getJobTimeline = async (req, res, next) => {
  try {
    const ownedJob = await ProcessingJob.exists({ _id: req.params.id, owner: req.user._id });
    if (!ownedJob) return res.status(404).json({ success: false, message: 'Processing job not found' });
    const logs = await ProcessingLog.find({ jobId: req.params.id, owner: req.user._id }).sort({ createdAt: 1 });
    res.status(200).json({
      success: true,
      data: logs,
    });
  } catch (err) {
    next(err);
  }
};

const cancelJob = async (req, res, next) => {
  try {
    const job = await ProcessingJob.findOneAndUpdate(
      { _id: req.params.id, owner: req.user._id, status: { $in: ['PENDING', 'RUNNING', 'RETRYING'] } },
      { $set: { status: 'CANCELLED', completedAt: new Date() }, $unset: { 'inputRef.rawInput': 1 } },
      { new: true }
    );

    if (!job) {
      return res.status(409).json({
        success: false,
        message: 'Job cannot be cancelled or already finished',
      });
    }

    abortJob(job._id);
    if (job.jobType === 'resume_parse') await Resume.updateOne({ _id: job.inputRef.resumeId, owner: req.user._id },
      { $set: { processingStatus: 'CANCELLED' } });
    if (job.inputRef.questionId) await InterviewQuestion.updateOne({ _id: job.inputRef.questionId, evaluationJobId: job._id },
      { $unset: { evaluationJobId: 1 } });

    res.status(200).json({
      success: true,
      message: 'Job cancelled successfully',
      data: job,
    });
  } catch (err) {
    next(err);
  }
};

const getProviderHealth = async (req, res, next) => {
  try {
    const health = providerFactory.getProvidersStatus();
    res.status(200).json({
      success: true,
      data: health,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getJobStatus,
  getJobTimeline,
  cancelJob,
  getProviderHealth,
};
