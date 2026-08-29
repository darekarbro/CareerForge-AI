const monitoringAgent = require('./monitoringAgent');

class RecoveryAgent {
  /**
   * Classify error into spec failure classes
   */
  classifyError(error) {
    const msg = (error.message || '').toLowerCase();
    const status = error.status || error.response?.status;

    if (msg.includes('pdf') || msg.includes('docx') || msg.includes('extract') || msg.includes('corrupt')) {
      return {
        class: 'PARSE_FAILURE',
        action: 'escalate',
        reason: 'The uploaded resume file could not be decoded or was formatted incompatibly.',
      };
    }

    if (status === 429 || msg.includes('rate limit') || msg.includes('quota')) {
      return {
        class: 'RATE_LIMIT',
        action: 'retry_with_backoff',
        backoffMs: 2000,
        reason: 'AI provider rate limit reached. Retrying with exponential backoff.',
      };
    }

    if (msg.includes('missing') || msg.includes('required') || msg.includes('undefined')) {
      return {
        class: 'MISSING_FIELDS',
        action: 'escalate',
        reason: 'Required schema fields were absent in input payload.',
      };
    }

    if (status >= 500 || msg.includes('timeout') || msg.includes('econnreset') || msg.includes('enotfound')) {
      return {
        class: 'TRANSIENT',
        action: 'retry_with_backoff',
        backoffMs: 1500,
        reason: 'Transient network or provider connectivity glitch.',
      };
    }

    return {
      class: 'AI_PROVIDER_FAILURE',
      action: 'fallback',
      reason: 'AI provider returned invalid format or failed to generate completion.',
    };
  }

  /**
   * Handle pipeline error with monitoring
   */
  async handleFailure({ jobId, userId, agent, error, retryCount = 0, maxRetries = 2 }) {
    const classification = this.classifyError(error);

    await monitoringAgent.logEvent({
      jobId,
      userId,
      agent: 'recovery',
      level: 'warning',
      message: `Recovery Agent evaluated error from [${agent}]: ${classification.class} — Action: ${classification.action}`,
      step: 'error_recovery',
      metadata: {
        errorClass: classification.class,
        retryCount,
        originalError: error.message,
      },
    });

    if (classification.action === 'retry_with_backoff' && retryCount < maxRetries) {
      return {
        shouldRetry: true,
        delayMs: classification.backoffMs * Math.pow(2, retryCount),
        classification,
      };
    }

    return {
      shouldRetry: false,
      classification,
    };
  }
}

module.exports = new RecoveryAgent();
