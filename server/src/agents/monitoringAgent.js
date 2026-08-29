const ProcessingLog = require('../models/ProcessingLog');
const { emitAgentEvent } = require('../config/socket');

class MonitoringAgent {
  /**
   * Log and broadcast an agent timeline event
   */
  async logEvent({ jobId, userId, agent, level = 'info', message, step, durationMs = 0, metadata = {} }) {
    try {
      // Broadcast via WebSocket immediately
      emitAgentEvent(jobId, userId, {
        agent,
        level,
        message,
        step,
        durationMs,
        metadata,
      });

      // Persist log entry in database if jobId exists
      if (jobId) {
        await ProcessingLog.create({
          jobId,
          owner: userId,
          agent,
          level,
          message,
          step,
          durationMs,
          metadata,
        });
      }
    } catch (err) {
      console.error('[MonitoringAgent] Error logging event:', err.message);
    }
  }
}

module.exports = new MonitoringAgent();
