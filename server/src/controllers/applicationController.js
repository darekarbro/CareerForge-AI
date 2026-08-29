const applicationService = require('../services/applicationService');

const listApplications = async (req, res, next) => {
  try {
    const { status, search, sort } = req.query;
    const apps = await applicationService.listApplications(req.user._id, { status, search, sort });
    res.status(200).json({
      success: true,
      data: apps,
    });
  } catch (err) {
    next(err);
  }
};

const createApplication = async (req, res, next) => {
  try {
    const app = await applicationService.createApplication(req.user._id, req.body);
    res.status(201).json({
      success: true,
      message: 'Application added to pipeline',
      data: app,
    });
  } catch (err) {
    next(err);
  }
};

const updateApplication = async (req, res, next) => {
  try {
    const app = await applicationService.updateApplication(req.params.id, req.user._id, req.body);
    res.status(200).json({
      success: true,
      message: 'Application updated',
      data: app,
    });
  } catch (err) {
    next(err);
  }
};

const deleteApplication = async (req, res, next) => {
  try {
    const result = await applicationService.deleteApplication(req.params.id, req.user._id);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

const getAnalytics = async (req, res, next) => {
  try {
    const analytics = await applicationService.getAnalytics(req.user._id);
    res.status(200).json({
      success: true,
      data: analytics,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listApplications,
  createApplication,
  updateApplication,
  deleteApplication,
  getAnalytics,
};
