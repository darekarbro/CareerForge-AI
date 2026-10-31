const ChatCompletionProvider = require('./chatCompletionProvider');
const env = require('../config/env');
class OpenRouterProvider extends ChatCompletionProvider {
  constructor() {
    super({ name: 'openrouter', apiKey: env.OPENROUTER_API_KEY, model: env.OPENROUTER_MODEL,
      baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
      headers: { 'HTTP-Referer': 'https://careerforge-ai.dev', 'X-Title': 'CareerForge AI Platform' } });
  }
}
module.exports = OpenRouterProvider;
