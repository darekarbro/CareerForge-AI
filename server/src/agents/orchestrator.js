const { runProcessingJob } = require('../services/processingJobLifecycle');

class Orchestrator {
  async runJob(jobId) {
    return runProcessingJob(jobId, async (execution) => {
      const { job } = execution;
      switch (job.jobType) {
        case 'resume_parse': return require('../services/resumeService').processUpload(execution);
        case 'resume_tailor': return require('../services/tailoringService').processTailoring(execution);
        case 'resume_copilot': return require('../services/copilotService').process(execution);
        case 'section_rewrite': return require('../services/sectionService').processSection(execution);
        case 'ats_score': return require('../services/assessmentService').processAssessment(execution);
        case 'gap_analysis': return require('../services/gapAnalysisService').processAnalysis(execution);
        case 'question_generation': return require('../services/interviewService').processQuestions(execution);
        case 'answer_evaluation': return require('../services/interviewService').processAnswer(execution);
        default: throw new Error('Unsupported processing job type: ' + job.jobType);
      }
    });
  }
}
module.exports = new Orchestrator();
