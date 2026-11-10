const GroqProvider = require('./groqProvider');
const OpenRouterProvider = require('./openRouterProvider');
const GeminiProvider = require('./geminiProvider');
const DeterministicProvider = require('./deterministicProvider');
const { validateResult } = require('./validateResult');
const { throwIfCancelled } = require('../services/jobContext');
const { modelVersion } = require('../services/assessmentRubrics');

class ProviderFactory {
  constructor() {
    this.groq = new GroqProvider();
    this.openRouter = new OpenRouterProvider();
    this.gemini = new GeminiProvider();
    this.deterministic = new DeterministicProvider();
  }

  getProvidersStatus() {
    const providers = { groq: this.groq, openrouter: this.openRouter, gemini: this.gemini };
    const policies = require('../services/operationalControls').policies();
    const statuses = Object.fromEntries(Object.entries(providers).map(([name, provider]) =>
      [name, { configured: provider.isAvailable(), approved: policies.some((policy) => policy.provider === name && policy.model === provider.model), model: provider.model }]));
    return {
      ...statuses,
      deterministic: { configured: true, description: 'Offline extraction and heuristic scoring' },
      activeProvider: policies.find((policy) => statuses[policy.provider]?.configured && statuses[policy.provider]?.model === policy.model)?.provider || 'deterministic-fallback',
    };
  }

  withProvider(result, provider) {
    if (Array.isArray(result)) { result.aiProvider = provider; return result; }
    return { ...result, aiProvider: provider };
  }

  // Final assessment scores use a published rubric, never ungrounded provider prose.
  async executeAssessment(action, params, onAttempt) {
    if (!['scoreATS', 'analyzeGap'].includes(action)) throw new Error('Unsupported local assessment');
    throwIfCancelled();
    const start = Date.now();
    if (onAttempt) await onAttempt(this.deterministic.name);
    const result = await this.deterministic[action](params);
    validateResult(action, result, params);
    throwIfCancelled();
    await this.recordUsage(require('../services/jobContext').context.getStore(), { action, provider: this.deterministic.name,
      model: modelVersion, durationMs: Date.now() - start, status: 'success', inputTokens: 0, outputTokens: 0, costUsd: 0 });
    return this.withProvider(result, this.deterministic.name);
  }

  async execute(actionName, params = {}, onProviderAttempt = null) {
    throwIfCancelled();
    // UI record identities are not career facts and must not be sent to providers.
    if (params && typeof params === 'object') params = JSON.parse(JSON.stringify(params, (key, value) => ['entryId', '_id', '__v'].includes(key) ? undefined : value));
    const scope = require('../services/jobContext').context.getStore();
    const controls = require('../services/operationalControls'), telemetry = require('../services/telemetry');
    const candidates = [this.groq, this.openRouter, this.gemini];
    const policy = require('../config/env').AI_MODEL_POLICY_PATH ? controls.policies() : null;
    const ordered = policy ? policy.map((entry) => candidates.find((provider) => provider.name === entry.provider && provider.model === entry.model)).filter(Boolean) : candidates;
    for (const [attempt, provider] of [...ordered, this.deterministic].entries()) {
      const account = scope?.owner ? await require('../models/User').findOne({ _id: scope.owner, deleting: { $ne: true } }).select('privacy emailVerifiedAt') : null;
      if (scope?.owner && !account) throw Object.assign(new Error('Account unavailable'), { code: 'JOB_CANCELLED', statusCode: 409 });
      if (scope?.owner && provider !== this.deterministic && (!account.emailVerifiedAt || account.privacy?.providers?.[provider.name] !== true)) continue;
      if (!provider.isAvailable()) continue;
      const start = Date.now();
      if (scope) scope.providerUsage = null;
      if (scope) scope.reservedMicrousd = 0;
      try {
        if (onProviderAttempt) await onProviderAttempt(provider.name);
        const result = await telemetry.span('provider.execute', { action: actionName, provider: provider.name, model: provider.model || 'offline-rules-v1', attempt }, () => provider[actionName](params));
        throwIfCancelled();
        validateResult(actionName, result, params);
        // Only the local rubric can assign local technical evidence metadata.
        if (actionName === 'evaluateAnswer' && provider !== this.deterministic) delete result.technicalAssessment;
        await this.recordUsage(scope, { action: actionName, provider: provider.name, model: provider.model || 'offline-rules-v1', durationMs: Date.now() - start, status: 'success', reservedMicrousd: scope?.reservedMicrousd || 0, ...scope?.providerUsage });
        return this.withProvider(result, provider.name);
      } catch (error) {
        await this.recordUsage(scope, { action: actionName, provider: provider.name, model: provider.model || 'offline-rules-v1', durationMs: Date.now() - start, status: 'failed', reservedMicrousd: scope?.reservedMicrousd || 0 });
        throwIfCancelled();
        if (provider === this.deterministic) throw error;
        console.warn('[ProviderFactory]', { provider: provider.name, action: actionName, code: typeof error.code === 'string' ? error.code : 'PROVIDER_FAILURE', ...telemetry.ids() });
      }
    }
    throw new Error('No AI provider available');
  }
  async recordUsage(scope, record) {
    const telemetry = require('../services/telemetry');
    record = { ...record, ...telemetry.ids() };
    telemetry.measure('careerforge.provider.attempts', 1, { action: record.action, provider: record.provider, status: record.status });
    telemetry.measure('careerforge.provider.duration_ms', record.durationMs, { action: record.action, provider: record.provider }, true);
    if (!scope?.jobId) return;
    try { await require('../models/ProcessingJob').updateOne({ _id: scope.jobId, owner: scope.owner }, { $push: { usage: { $each: [record], $slice: -30 } } }); }
    catch { /* Usage accounting must not discard a completed AI response. */ }
  }
}
module.exports = new ProviderFactory();
