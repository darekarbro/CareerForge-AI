const ChatCompletionProvider = require('./chatCompletionProvider');
const env = require('../config/env');

class GroqProvider extends ChatCompletionProvider {
  constructor() {
    super({
      name: 'groq', apiKey: env.GROQ_API_KEY, model: env.GROQ_MODEL,
      baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
      strictSchema: ['openai/gpt-oss-120b', 'openai/gpt-oss-20b'].includes(env.GROQ_MODEL),
      timeoutMs: env.GROQ_TIMEOUT_MS,
    });
  }
}
module.exports = GroqProvider;
