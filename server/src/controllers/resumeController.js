const resumeService = require('../services/resumeService');
const tailoringService = require('../services/tailoringService');
const gapAnalysisService = require('../services/gapAnalysisService');

const getDashboardMetrics = async (req, res, next) => {
  try {
    const metrics = await resumeService.getDashboardMetrics(req.user._id);
    res.status(200).json({
      success: true,
      data: metrics,
    });
  } catch (err) {
    next(err);
  }
};

const listResumes = async (req, res, next) => {
  try {
    const resumes = await resumeService.listUserResumes(req.user._id);
    res.status(200).json({
      success: true,
      data: resumes,
    });
  } catch (err) {
    next(err);
  }
};

const uploadResume = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please attach a resume file (PDF, DOCX, or TXT).',
      });
    }

    const { title } = req.body;
    const result = await resumeService.uploadAndProcessResume({
      file: req.file,
      userId: req.user._id,
      title,
    });

    res.status(202).json({
      success: true,
      message: 'Resume uploaded and queued for processing',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

const getResume = async (req, res, next) => {
  try {
    const resume = await resumeService.getResumeById(req.params.id, req.user._id);
    res.status(200).json({
      success: true,
      data: resume,
    });
  } catch (err) {
    next(err);
  }
};

const deleteResume = async (req, res, next) => {
  try {
    const result = await resumeService.deleteResume(req.params.id, req.user._id);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

const tailorResume = async (req, res, next) => {
  try {
    const { targetRole, jobDescriptionText } = req.body;
    const result = await tailoringService.tailorResume({
      resumeId: req.params.id,
      userId: req.user._id,
      targetRole: targetRole || 'Fullstack Developer',
      jobDescriptionText,
    });

    res.status(200).json({
      success: true,
      message: 'Resume tailored successfully',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

const getVersions = async (req, res, next) => {
  try {
    const versions = await tailoringService.getVersions(req.params.id, req.user._id);
    res.status(200).json({
      success: true,
      data: versions,
    });
  } catch (err) {
    next(err);
  }
};

const getAtsScore = async (req, res, next) => {
  try {
    const atsScore = await resumeService.getAtsScore(req.params.id, req.user._id);
    res.status(200).json({
      success: true,
      data: atsScore,
    });
  } catch (err) {
    next(err);
  }
};

const runGapAnalysis = async (req, res, next) => {
  try {
    const { jobDescriptionText, targetRole, company } = req.body;
    if (!jobDescriptionText) {
      return res.status(400).json({
        success: false,
        message: 'Please provide job description text to run gap analysis.',
      });
    }

    const result = await gapAnalysisService.runGapAnalysis({
      resumeId: req.params.id,
      userId: req.user._id,
      jobDescriptionText,
      targetRole,
      company,
    });

    res.status(200).json({
      success: true,
      message: 'Gap analysis completed',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

const downloadTailoredPdf = async (req, res, next) => {
  try {
    const { versionId } = req.params;
    const docStream = await tailoringService.generatePdf(versionId, req.user._id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=tailored_resume_${versionId}.pdf`);

    docStream.pipe(res);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getDashboardMetrics,
  listResumes,
  uploadResume,
  getResume,
  deleteResume,
  tailorResume,
  getVersions,
  getAtsScore,
  runGapAnalysis,
  downloadTailoredPdf,
};
