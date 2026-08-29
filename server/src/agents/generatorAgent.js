const providerFactory = require('../providers/providerFactory');
const monitoringAgent = require('./monitoringAgent');

class GeneratorAgent {
  /**
   * Generate role-tailored resume rewrite and side-by-side diff
   */
  async tailorResume({ resumeData, targetRole, jobDescriptionText, jobId, userId }) {
    const startTime = Date.now();

    await monitoringAgent.logEvent({
      jobId,
      userId,
      agent: 'generator',
      level: 'info',
      message: `Generator Agent tailoring resume highlights and skill alignments for role: "${targetRole}"...`,
      step: 'tailoring_start',
    });

    const result = await providerFactory.execute(
      'tailorResume',
      { resumeData, targetRole, jobDescriptionText },
      (providerName) => {
        monitoringAgent.logEvent({
          jobId,
          userId,
          agent: 'generator',
          level: 'info',
          message: `Generator crafting tailored bullet points with provider [${providerName}]`,
          step: 'ai_tailoring',
        });
      }
    );

    await monitoringAgent.logEvent({
      jobId,
      userId,
      agent: 'generator',
      level: 'success',
      message: `Resume tailored successfully! ${result.diffFromOriginal?.addedSkills?.length || 0} skills aligned, ${result.diffFromOriginal?.modifiedHighlights?.length || 0} bullets optimized. Served by [${result.aiProvider}]`,
      step: 'tailoring_completed',
      durationMs: Date.now() - startTime,
      metadata: { aiProvider: result.aiProvider },
    });

    return result;
  }

  /**
   * Generate role-aware & resume-aware mock interview questions
   */
  async generateQuestions({ resumeData, targetRole, jobDescriptionText, count = 5, jobId, userId }) {
    const startTime = Date.now();

    await monitoringAgent.logEvent({
      jobId,
      userId,
      agent: 'generator',
      level: 'info',
      message: `Generator Agent synthesizing ${count} interview questions tailored for "${targetRole}"...`,
      step: 'question_generation_start',
    });

    const questions = await providerFactory.execute(
      'generateQuestions',
      { resumeData, targetRole, jobDescriptionText, count },
      (providerName) => {
        monitoringAgent.logEvent({
          jobId,
          userId,
          agent: 'generator',
          level: 'info',
          message: `Generator crafting question set & model answers with provider [${providerName}]`,
          step: 'ai_question_generation',
        });
      }
    );

    const questionsList = Array.isArray(questions) ? questions : (questions.questions || []);

    await monitoringAgent.logEvent({
      jobId,
      userId,
      agent: 'generator',
      level: 'success',
      message: `Synthesized ${questionsList.length} mixed technical/behavioral questions with model answers. Served by [${questions.aiProvider || 'deterministic-fallback'}]`,
      step: 'question_generation_completed',
      durationMs: Date.now() - startTime,
      metadata: { count: questionsList.length, aiProvider: questions.aiProvider },
    });

    return {
      questions: questionsList,
      aiProvider: questions.aiProvider || 'deterministic-fallback',
    };
  }
}

module.exports = new GeneratorAgent();
