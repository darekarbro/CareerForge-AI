/**
 * Base AI Provider interface defining standard method signatures across all providers
 */
class BaseProvider {
  constructor(name) {
    this.name = name;
  }

  /**
   * Check if provider is available / configured
   * @returns {boolean}
   */
  isAvailable() {
    throw new Error('Method isAvailable() must be implemented');
  }

  /**
   * Parse resume raw text into structured JSON data
   */
  async parseResume(rawText) {
    throw new Error('Method parseResume() must be implemented');
  }

  /**
   * Generate role-tailored resume content and diff
   */
  async tailorResume({ resumeData, targetRole, jobDescriptionText }) {
    throw new Error('Method tailorResume() must be implemented');
  }

  /**
   * Compute ATS formatting & keyword compatibility score
   */
  async scoreATS({ resumeData, rawText }) {
    throw new Error('Method scoreATS() must be implemented');
  }

  /**
   * Run JD-to-resume gap analysis with supporting line references
   */
  async analyzeGap({ resumeData, jobDescriptionText, targetRole }) {
    throw new Error('Method analyzeGap() must be implemented');
  }

  /**
   * Generate role-aware & resume-aware mock interview questions
   */
  async generateQuestions({ resumeData, targetRole, jobDescriptionText, count = 5 }) {
    throw new Error('Method generateQuestions() must be implemented');
  }

  /**
   * Evaluate mock interview user answer across 4 dimensions
   */
  async evaluateAnswer({ question, userAnswer, suggestedAnswer, targetRole }) {
    throw new Error('Method evaluateAnswer() must be implemented');
  }
}

module.exports = BaseProvider;
