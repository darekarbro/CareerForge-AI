const providerFactory = require('../providers/providerFactory');
const monitoringAgent = require('./monitoringAgent');

class EvaluatorAgent {
  /**
   * Evaluate user's submitted mock-interview answer across 4 dimensions:
   * 1. Clarity, 2. Relevance, 3. Structure / STAR, 4. Technical correctness
   */
  async evaluateAnswer({ question, userAnswer, suggestedAnswer, targetRole, jobId, userId }) {
    const startTime = Date.now();

    await monitoringAgent.logEvent({
      jobId,
      userId,
      agent: 'evaluator',
      level: 'info',
      message: `Evaluator Agent scoring candidate response on Clarity, Relevance, STAR Structure, and Technical depth...`,
      step: 'evaluating_answer_start',
    });

    const feedback = await providerFactory.execute(
      'evaluateAnswer',
      { question, userAnswer, suggestedAnswer, targetRole },
      (providerName) => {
        monitoringAgent.logEvent({
          jobId,
          userId,
          agent: 'evaluator',
          level: 'info',
          message: `Evaluator assessing candidate answer using provider [${providerName}]`,
          step: 'ai_evaluation',
        });
      }
    );

    await monitoringAgent.logEvent({
      jobId,
      userId,
      agent: 'evaluator',
      level: 'success',
      message: `Evaluation completed! Overall Score: ${feedback.overallScore}/100 (Clarity: ${feedback.clarityScore}, Relevance: ${feedback.relevanceScore}, Structure: ${feedback.structureScore}, Tech: ${feedback.technicalScore}). Served by [${feedback.aiProvider}]`,
      step: 'evaluation_completed',
      durationMs: Date.now() - startTime,
      metadata: {
        overallScore: feedback.overallScore,
        aiProvider: feedback.aiProvider,
      },
    });

    return feedback;
  }
}

module.exports = new EvaluatorAgent();
