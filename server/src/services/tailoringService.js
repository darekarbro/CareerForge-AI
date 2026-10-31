const Resume = require('../models/Resume');
const TailoredResume = require('../models/TailoredResume');
const Counter = require('../models/ResumeVersionCounter');
const generatorAgent = require('../agents/generatorAgent');
const analyzerAgent = require('../agents/analyzerAgent');
const { createJob, dispatchJob } = require('./jobService');
const { plain, resumeText } = require('../providers/resumeFacts');
const { cancellationError } = require('./jobContext');
const PDFDocument = require('pdfkit');
const { improvementSuggestions } = require('../providers/resumeWriting');

class TailoringService {
  async tailorResume({ resumeId, userId, targetRole, jobDescriptionText = '' }) {
    const resume = await require('./resumeService').getReadyResume(resumeId, userId);
    const job = await createJob({ userId, jobType: 'resume_tailor', inputRef: {
      resumeId: resume._id, targetRole, rawInput: { targetRole, jobDescriptionText },
    } });
    return dispatchJob(job);
  }
  async processTailoring({ job, checkpoint, commit }) {
    const resume = await require('./resumeService').getReadyResume(job.inputRef.resumeId, job.owner);
    let original = plain(resume.parsedData);
    const { targetRole, jobDescriptionText } = job.inputRef.rawInput;
    const recoverSource = resume.aiProvider !== 'groq' ||
      (resume.rawText?.length > 8000 && (resume.parsingInputLength || 0) < resume.rawText.length);
    if (recoverSource && resume.rawText && require('../providers/providerFactory').groq.isAvailable() && resume.rawText.length <= 48000) {
      const recovered = await require('../agents/parserAgent').parse({ rawText: resume.rawText,
        jobId: job._id, userId: job.owner });
      if (recovered.aiProvider === 'groq') original = plain(recovered.parsedData);
      await checkpoint();
    }
    const tailoredData = await generatorAgent.tailorResume({ resumeData: original, targetRole, jobDescriptionText,
      jobId: job._id, userId: job.owner });
    await checkpoint();
    const complete = { ...original, summary: tailoredData.summary, skills: tailoredData.skills,
      workExperience: tailoredData.workExperience, projects: tailoredData.projects };
    const atsScore = await analyzerAgent.scoreATS({ resumeData: complete, rawText: resumeText(complete),
      jobId: job._id, userId: job.owner });
    return commit(async () => {
      if (!await Resume.exists({ _id: resume._id, owner: job.owner, deleting: { $ne: true } })) throw cancellationError();
      const latest = await TailoredResume.findOne({ resumeId: resume._id }).sort({ version: -1 }).select('version');
      try {
        await Counter.updateOne({ _id: resume._id }, { $setOnInsert: { sequence: latest?.version || 0 } }, { upsert: true });
      } catch (error) { if (error.code !== 11000) throw error; }
      const counter = await Counter.findByIdAndUpdate(resume._id, { $inc: { sequence: 1 } }, { new: true });
      const tailoredResume = await TailoredResume.create({
        resumeId: resume._id, owner: job.owner, targetRole, jobDescriptionText, version: counter.sequence,
        tailoredContent: complete, atsScore, diffFromOriginal: tailoredData.diffFromOriginal, aiProvider: tailoredData.aiProvider,
        improvementSuggestions: improvementSuggestions(original),
      });
      return { tailoredResume, aiProvider: tailoredData.aiProvider };
    });
  }
  async getVersions(resumeId, userId) {
    await require('./resumeService').getResumeById(resumeId, userId);
    return TailoredResume.find({ resumeId, owner: userId }).sort({ version: -1 });
  }
  async getTailoredVersion(versionId, userId) {
    const tailored = await TailoredResume.findOne({ _id: versionId, owner: userId });
    if (!tailored) throw Object.assign(new Error('Tailored resume version not found'), { statusCode: 404 });
    return tailored;
  }
  async generatePdf(versionId, userId) {
    const tailored = await this.getTailoredVersion(versionId, userId);
    const resume = await require('./resumeService').getResumeById(tailored.resumeId, userId);
    const original = plain(resume.parsedData), content = plain(tailored.tailoredContent);
    const contact = content.contactInfo || original.contactInfo || {};
    const printable = (value) => String(value || '').replace(/[\u2010-\u2015\u2212]/g, '-').replace(/\u00a0/g, ' ');
    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    doc.font('Helvetica-Bold').fontSize(20).text(printable(contact.name || resume.title), { align: 'center' });
    doc.font('Helvetica').fontSize(9.5).text(
      printable([contact.email, contact.phone, contact.location, contact.linkedin, contact.github, contact.portfolio].filter(Boolean).join(' | ')),
      { align: 'center' });
    doc.moveDown();
    const room = (height) => { if (doc.y + height > doc.page.height - doc.page.margins.bottom) doc.addPage(); };
    const section = (title) => {
      room(75); doc.moveDown(.6).font('Helvetica-Bold').fontSize(12).text(title);
      const y = doc.y + 3;
      doc.save().strokeColor('#b7b7b7').lineWidth(.5).moveTo(48, y).lineTo(doc.page.width - 48, y).stroke().restore();
      doc.moveDown(.6);
    };
    const line = (text, bold = false) => { if (text) doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10.5).text(printable(text), { lineGap: 2 }); };
    if (content.summary) { section('PROFESSIONAL SUMMARY'); line(content.summary); }
    if (content.skills?.all?.length) {
      section('SKILLS');
      const used = new Set();
      for (const [label, values] of [['Technical skills', content.skills.technical], ['Frameworks', content.skills.frameworks],
        ['Tools & platforms', content.skills.tools], ['Collaboration', content.skills.soft], ['Additional skills', content.skills.all]]) {
        const skills = (values || []).filter((value) => {
          if (typeof value !== 'string') return false;
          const key = value.trim().toLowerCase();
          if (!key || used.has(key)) return false;
          used.add(key); return true;
        });
        if (skills.length) { line(label + ': ' + skills.join(', ')); doc.moveDown(.15); }
      }
    }
    if (content.workExperience?.length) {
      section('EXPERIENCE');
      content.workExperience.forEach((entry) => {
        room(70);
        line([entry.role, entry.company].filter(Boolean).join(' - '), true);
        line([entry.startDate && [entry.startDate, entry.endDate || (entry.current ? 'Present' : '')].filter(Boolean).join(' - '), entry.location].filter(Boolean).join(' | '));
        (entry.highlights || []).forEach((bullet) => { line('• ' + bullet); doc.moveDown(.15); });
        doc.moveDown(.4);
      });
    }
    const education = content.education?.length ? content.education : original.education;
    if (education?.length) {
      section('EDUCATION');
      education.forEach((entry) => {
        room(60);
        line([entry.degree, entry.fieldOfStudy].filter(Boolean).join(' - '), true);
        line([entry.institution, entry.graduationYear, entry.score].filter(Boolean).join(' | '));
        doc.moveDown(.3);
      });
    }
    if (content.projects?.length) {
      section('PROJECTS');
      content.projects.forEach((project) => {
        room(75);
        line(project.title, true); line(project.description);
        line(project.technologies?.length ? 'Technologies: ' + project.technologies.join(', ') : ''); line(project.link);
        (project.highlights || []).forEach((bullet) => { line('• ' + bullet); doc.moveDown(.15); });
        doc.moveDown(.4);
      });
    }
    const certifications = content.certifications?.length ? content.certifications : original.certifications;
    if (certifications?.length) {
      section('CERTIFICATIONS');
      certifications.forEach((entry) => line([entry.name, entry.issuer, entry.year].filter(Boolean).join(' | ')));
    }
    doc.end();
    return doc;
  }
}
module.exports = new TailoringService();
