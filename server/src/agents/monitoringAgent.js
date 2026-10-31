const ProcessingLog = require('../models/ProcessingLog');
const { emitAgentEvent } = require('../config/socket');
class MonitoringAgent {
  async logEvent({ jobId, userId, agent, level = 'info', message, step, durationMs = 0, metadata = {} }) {
    const event = { agent, level, message, step, durationMs, metadata, timestamp: new Date() };
    try {
      if (jobId) {
        const log = await ProcessingLog.create({ jobId, owner: userId, ...event });
        event._id = String(log._id);
        event.timestamp = log.createdAt;
      }
      emitAgentEvent(jobId, userId, event);
    } catch (error) { console.error('Unable to persist processing event:', error.message); }
  }
}
module.exports = new MonitoringAgent();
