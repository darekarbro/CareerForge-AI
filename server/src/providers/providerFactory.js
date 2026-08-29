const OpenRouterProvider = require('./openRouterProvider');
const GeminiProvider = require('./geminiProvider');
const DeterministicProvider = require('./deterministicProvider');

class ProviderFactory {
  constructor() {
    this.openRouter = new OpenRouterProvider();
    this.gemini = new GeminiProvider();
    this.deterministic = new DeterministicProvider();
  }

  /**
   * Returns list of configured providers and active status
   */
  getProvidersStatus() {
    return {
      openrouter: {
        configured: this.openRouter.isAvailable(),
        model: this.openRouter.model,
      },
      gemini: {
        configured: this.gemini.isAvailable(),
        model: this.gemini.model,
      },
      deterministic: {
        configured: true,
        description: 'Offline rule-based & regex heuristics fallback engine',
      },
      activeProvider: this.openRouter.isAvailable()
        ? 'openrouter'
        : this.gemini.isAvailable()
        ? 'gemini'
        : 'deterministic-fallback',
    };
  }

  /**
   * Executes an AI action through the fallback chain:
   * 1. OpenRouter -> 2. Gemini -> 3. Deterministic
   */
  async execute(actionName, params = {}, onProviderAttempt = null) {
    // 1. Try OpenRouter
    if (this.openRouter.isAvailable()) {
      try {
        if (onProviderAttempt) onProviderAttempt('openrouter');
        const result = await this.openRouter[actionName](params);
        return {
          ...result,
          aiProvider: 'openrouter',
        };
      } catch (err) {
        console.warn(`[ProviderFactory] OpenRouter failed for ${actionName}: ${err.message}. Falling back...`);
      }
    }

    // 2. Try Gemini
    if (this.gemini.isAvailable()) {
      try {
        if (onProviderAttempt) onProviderAttempt('gemini');
        const result = await this.gemini[actionName](params);
        return {
          ...result,
          aiProvider: 'gemini',
        };
      } catch (err) {
        console.warn(`[ProviderFactory] Gemini failed for ${actionName}: ${err.message}. Falling back...`);
      }
    }

    // 3. Fallback to Deterministic
    if (onProviderAttempt) onProviderAttempt('deterministic-fallback');
    const result = await this.deterministic[actionName](params);
    return {
      ...result,
      aiProvider: 'deterministic-fallback',
    };
  }
}

const providerFactory = new ProviderFactory();
module.exports = providerFactory;
