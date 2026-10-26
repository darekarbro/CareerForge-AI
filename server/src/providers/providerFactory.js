const GroqProvider = require('./groqProvider');
const OpenRouterProvider = require('./openRouterProvider');
const GeminiProvider = require('./geminiProvider');
const DeterministicProvider = require('./deterministicProvider');
const { validateResult } = require('./validateResult');
const { throwIfCancelled } = require('../services/jobContext');

class ProviderFactory {
  constructor() {
    this.groq = new GroqProvider();
    this.openRouter = new OpenRouterProvider();
    this.gemini = new GeminiProvider();
    this.deterministic = new DeterministicProvider();
  }

  getProvidersStatus() {
    const providers = { groq: this.groq, openrouter: this.openRouter, gemini: this.gemini };
    const statuses = Object.fromEntries(Object.entries(providers).map(([name, provider]) =>
      [name, { configured: provider.isAvailable(), model: provider.model }]));
    return {
      ...statuses,
      deterministic: { configured: true, description: 'Offline extraction and heuristic scoring' },
      activeProvider: Object.keys(providers).find((name) => statuses[name].configured) || 'deterministic-fallback',
    };
  }

  withProvider(result, provider) {
    if (Array.isArray(result)) { result.aiProvider = provider; return result; }
    return { ...result, aiProvider: provider };
  }

  async execute(actionName, params = {}, onProviderAttempt = null) {
    throwIfCancelled();
    for (const provider of [this.groq, this.openRouter, this.gemini, this.deterministic]) {
      if (!provider.isAvailable()) continue;
      try {
        if (onProviderAttempt) await onProviderAttempt(provider.name);
        const result = await provider[actionName](params);
        throwIfCancelled();
        validateResult(actionName, result, params);
        return this.withProvider(result, provider.name);
      } catch (error) {
        throwIfCancelled();
        if (provider === this.deterministic) throw error;
        console.warn('[ProviderFactory] ' + provider.name + ' failed for ' + actionName + ': ' + error.message + '. Falling back...');
      }
    }
    throw new Error('No AI provider available');
  }
}
module.exports = new ProviderFactory();
