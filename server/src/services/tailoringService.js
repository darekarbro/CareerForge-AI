const Resume = require('../models/Resume');
const TailoredResume = require('../models/TailoredResume');
const ProcessingJob = require('../models/ProcessingJob');
const generatorAgent = require('../agents/generatorAgent');
const analyzerAgent = require('../agents/analyzerAgent');
const { runProcessingJob } = require('./processingJobLifecycle');
const PDFDocument = require('pdfkit');

class TailoringService {
  async tailorResume({ resumeId, userId, targetRole, jobDescriptionText }) {
    const resume = await Resume.findOne({ _id: resumeId, owner: userId });
    if (!resume) {
      const error = new Error('Base resume not found');
      error.statusCode = 404;
      throw error;
    }

    // Determine current version count for this resume
    const existingCount = await TailoredResume.countDocuments({ resumeId });
    const nextVersion = existingCount + 1;

    // Create ProcessingJob
    const processingJob = await ProcessingJob.create({
      owner: userId,
      jobType: 'resume_tailor',
      status: 'PENDING',
      inputRef: {
        resumeId: resume._id,
        targetRole,
        rawInput: {
          resumeData: resume.parsedData,
          targetRole,
          jobDescriptionText,
        },
      },
    });

    const { tailoredResume } = await runProcessingJob(processingJob, async () => {
      const tailoredData = await generatorAgent.tailorResume({
        resumeData: resume.parsedData,
        targetRole,
        jobDescriptionText,
        jobId: processingJob._id,
        userId,
      });

      const atsScore = await analyzerAgent.scoreATS({
        resumeData: tailoredData,
        rawText: '',
        jobId: processingJob._id,
        userId,
      });

      const createdResume = await TailoredResume.create({
        resumeId: resume._id,
        owner: userId,
        targetRole,
        jobDescriptionText,
        tailoredContent: {
          summary: tailoredData.summary,
          skills: tailoredData.skills,
          workExperience: tailoredData.workExperience,
          projects: tailoredData.projects,
        },
        atsScore,
        diffFromOriginal: tailoredData.diffFromOriginal,
        version: nextVersion,
        aiProvider: tailoredData.aiProvider,
      });

      return { tailoredResume: createdResume, aiProvider: tailoredData.aiProvider };
    });

    return {
      tailoredResume,
      jobId: processingJob._id,
    };
  }

  async getVersions(resumeId, userId) {
    return TailoredResume.find({ resumeId, owner: userId }).sort({ version: -1 });
  }

  async getTailoredVersion(versionId, userId) {
    const tailored = await TailoredResume.findOne({ _id: versionId, owner: userId });
    if (!tailored) {
      const error = new Error('Tailored resume version not found');
      error.statusCode = 404;
      throw error;
    }
    return tailored;
  }

  /**
   * Generates a PDF stream for a tailored resume
   */
  async generatePdf(versionId, userId) {
    const tailored = await this.getTailoredVersion(versionId, userId);
    const resume = await Resume.findById(tailored.resumeId);

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const contact = resume?.parsedData?.contactInfo || {};

    // Header
    doc.fontSize(20).font('Helvetica-Bold').text(contact.name || 'Candidate Resume', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(
      [contact.email, contact.phone, contact.location, contact.linkedin].filter(Boolean).join(' | '),
      { align: 'center' }
    );
    doc.moveDown(0.5);
    doc.strokeColor('#1a1a1a').lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.5);

    // Target Role Banner
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#0055ff').text(`TARGET ROLE: ${tailored.targetRole.toUpperCase()}`);
    doc.fillColor('#1a1a1a');
    doc.moveDown(0.3);

    // Professional Summary
    if (tailored.tailoredContent?.summary) {
      doc.fontSize(12).font('Helvetica-Bold').text('PROFESSIONAL SUMMARY');
      doc.fontSize(9.5).font('Helvetica').text(tailored.tailoredContent.summary);
      doc.moveDown(0.5);
    }

    // Technical Skills
    const skills = tailored.tailoredContent?.skills?.all || [];
    if (skills.length > 0) {
      doc.fontSize(12).font('Helvetica-Bold').text('TECHNICAL SKILLS & COMPETENCIES');
      doc.fontSize(9.5).font('Helvetica').text(skills.join(' • '));
      doc.moveDown(0.5);
    }

    // Experience
    const expList = tailored.tailoredContent?.workExperience || [];
    if (expList.length > 0) {
      doc.fontSize(12).font('Helvetica-Bold').text('PROFESSIONAL EXPERIENCE');
      expList.forEach((exp) => {
        doc.fontSize(10).font('Helvetica-Bold').text(`${exp.role} — ${exp.company}`);
        doc.fontSize(8.5).font('Helvetica-Oblique').text(`${exp.startDate || ''} - ${exp.endDate || 'Present'} | ${exp.location || ''}`);
        (exp.highlights || []).forEach((bullet) => {
          doc.fontSize(9).font('Helvetica').text(`• ${bullet}`, { indent: 10 });
        });
        doc.moveDown(0.3);
      });
    }

    // Projects
    const projects = tailored.tailoredContent?.projects || [];
    if (projects.length > 0) {
      doc.fontSize(12).font('Helvetica-Bold').text('KEY PROJECTS');
      projects.forEach((proj) => {
        doc.fontSize(10).font('Helvetica-Bold').text(`${proj.title}`);
        if (proj.technologies?.length) {
          doc.fontSize(8.5).font('Helvetica-Oblique').text(`Technologies: ${proj.technologies.join(', ')}`);
        }
        (proj.highlights || []).forEach((bullet) => {
          doc.fontSize(9).font('Helvetica').text(`• ${bullet}`, { indent: 10 });
        });
        doc.moveDown(0.3);
      });
    }

    doc.end();
    return doc;
  }
}

module.exports = new TailoringService();
