const ProcessingJob = require('../models/ProcessingJob');
const ProcessingLog = require('../models/ProcessingLog');
const providerFactory = require('../providers/providerFactory');

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
    const logs = await ProcessingLog.find({ jobId: req.params.id }).sort({ createdAt: 1 });
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
      { _id: req.params.id, owner: req.user._id, status: { $in: ['PENDING', 'RUNNING'] } },
      { $set: { status: 'CANCELLED', completedAt: new Date() } },
      { new: true }
    );

    if (!job) {
      return res.status(400).json({
        success: false,
        message: 'Job cannot be cancelled or already finished',
      });
    }

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
