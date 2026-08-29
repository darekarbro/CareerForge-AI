const providerFactory = require('../providers/providerFactory');
const monitoringAgent = require('./monitoringAgent');

class AnalyzerAgent {
  /**
   * Run ATS compatibility scoring
   */
  async scoreATS({ resumeData, rawText, jobId, userId }) {
    const startTime = Date.now();

    await monitoringAgent.logEvent({
      jobId,
      userId,
      agent: 'analyzer',
      level: 'info',
      message: 'Analyzer Agent inspecting resume ATS formatting, section headers, and keyword density...',
      step: 'ats_evaluation_start',
    });

    const atsResult = await providerFactory.execute(
      'scoreATS',
      { resumeData, rawText },
      (providerName) => {
        monitoringAgent.logEvent({
          jobId,
          userId,
          agent: 'analyzer',
          level: 'info',
          message: `Analyzer calculating ATS breakdown using provider [${providerName}]`,
          step: 'ai_scoring',
        });
      }
    );

    await monitoringAgent.logEvent({
      jobId,
      userId,
      agent: 'analyzer',
      level: 'success',
      message: `ATS evaluation finished. Computed score: ${atsResult.score}/100 with ${atsResult.breakdown?.length || 0} category checks. Served by [${atsResult.aiProvider}]`,
      step: 'ats_evaluation_completed',
      durationMs: Date.now() - startTime,
      metadata: { atsScore: atsResult.score, aiProvider: atsResult.aiProvider },
    });

    return atsResult;
  }

  /**
   * Run JD-to-resume gap analysis
   */
  async analyzeGap({ resumeData, jobDescriptionText, targetRole, jobId, userId }) {
    const startTime = Date.now();

    await monitoringAgent.logEvent({
      jobId,
      userId,
      agent: 'analyzer',
      level: 'info',
      message: `Analyzer Agent conducting deep gap analysis against target role "${targetRole}"...`,
      step: 'gap_analysis_start',
    });

    const gapResult = await providerFactory.execute(
      'analyzeGap',
      { resumeData, jobDescriptionText, targetRole },
      (providerName) => {
        monitoringAgent.logEvent({
          jobId,
          userId,
          agent: 'analyzer',
          level: 'info',
          message: `Analyzer cross-referencing JD skills using provider [${providerName}]`,
          step: 'ai_gap_analysis',
        });
      }
    );

    await monitoringAgent.logEvent({
      jobId,
      userId,
      agent: 'analyzer',
      level: 'success',
      message: `Gap analysis complete: Match score ${gapResult.matchScore}% | ${(gapResult.matchedSkills || []).length} matched | ${(gapResult.mustHaveMissing || []).length} missing must-haves. Served by [${gapResult.aiProvider}]`,
      step: 'gap_analysis_completed',
      durationMs: Date.now() - startTime,
      metadata: { matchScore: gapResult.matchScore, aiProvider: gapResult.aiProvider },
    });

    return gapResult;
  }
}

module.exports = new AnalyzerAgent();
