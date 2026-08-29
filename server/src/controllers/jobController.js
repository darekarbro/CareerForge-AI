const jobSearchService = require('../services/jobSearchService');

const getSupportedRoles = async (req, res, next) => {
  try {
    const roles = jobSearchService.getSupportedRoles();
    res.status(200).json({
      success: true,
      data: roles,
    });
  } catch (err) {
    next(err);
  }
};

const generateSearchLinks = async (req, res, next) => {
  try {
    const { targetRole, resumeId, location } = req.body;
    if (!targetRole) {
      return res.status(400).json({
        success: false,
        message: 'targetRole is required.',
      });
    }

    const result = await jobSearchService.generateSearchLinks({
      userId: req.user._id,
      targetRole,
      resumeId,
      location,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getSupportedRoles,
  generateSearchLinks,
};
