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

const downloadOriginal = async (req, res, next) => {
  try {
    const { resume, download } = await resumeService.getOriginal(req.params.id, req.user._id);
    res.setHeader('Cache-Control', 'private, no-store');
    if (download.url) return res.redirect(download.url);
    return res.download(download.path, resume.originalFileName || 'resume.' + resume.fileType);
  } catch (error) { next(error); }
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

    res.status(202).json({
      success: true,
      message: 'Resume tailoring queued',
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

    res.status(202).json({
      success: true,
      message: 'Gap analysis queued',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

const downloadTailoredPdf = async (req, res, next) => {
  try {
    const { versionId } = req.params;
    const version = await tailoringService.getTailoredVersion(versionId, req.user._id);
    if (String(version.resumeId) !== req.params.id) return res.status(404).json({ success: false, message: 'Version not found' });
    const format = req.query.format || 'pdf', result = await tailoringService.exportVersion(versionId, req.user._id, format, req.query);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Type', format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `${req.query.preview === '1' ? 'inline' : 'attachment'}; filename=tailored_resume_${versionId}.${format}`);
    if (result.pages) res.setHeader('X-Page-Count', result.pages);
    res.setHeader('X-Content-Revision', result.version.contentRevision || 1);
    res.setHeader('X-Layout-Revision', result.version.layoutRevision || 1);
    if (req.query.preview !== '1') await require('../models/ProductEvent').create({ owner: req.user._id, type: format + '_export', resumeId: version.resumeId, versionId });
    res.send(result.buffer);
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
  downloadOriginal,
};
