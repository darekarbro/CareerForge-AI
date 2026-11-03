const providerFactory = require('../providers/providerFactory');
const monitoringAgent = require('./monitoringAgent');

class ParserAgent {
  /**
   * Extract raw text from file buffer based on mimetype or fileType
   */
  async extractTextFromBuffer(buffer, fileType = 'pdf', options = {}) {
    const type = fileType.toLowerCase();
    return require('../services/documentText').extract(buffer, type.includes('pdf') ? 'pdf' : /doc|word/.test(type) ? 'docx' : 'txt', { signal: require('../services/jobContext').getSignal(), ...options });
  }

  /**
   * Run full parse agent pipeline: extract text -> structured JSON
   */
  async parse({ fileBuffer, rawText, fileType = 'pdf', jobId, userId }) {
    const startTime = Date.now();

    await monitoringAgent.logEvent({
      jobId,
      userId,
      agent: 'parser',
      level: 'info',
      message: 'Parser Agent initiated file decoding and raw text extraction...',
      step: 'extracting_raw_text',
    });

    let text = rawText;
    if (!text && fileBuffer) {
      text = await this.extractTextFromBuffer(fileBuffer, fileType);
    }

    if (!text || text.trim().length === 0) {
      throw new Error('Could not extract meaningful text from resume file');
    }

    await monitoringAgent.logEvent({
      jobId,
      userId,
      agent: 'parser',
      level: 'info',
      message: `Extracted ${text.length} characters of raw text. Converting to structured schema...`,
      step: 'structuring_schema',
      durationMs: Date.now() - startTime,
    });

    const parsedResult = await providerFactory.execute(
      'parseResume',
      text,
      (providerName) => {
        monitoringAgent.logEvent({
          jobId,
          userId,
          agent: 'parser',
          level: 'info',
          message: `Parser delegating structural extraction to provider [${providerName}]`,
          step: 'ai_parsing',
        });
      }
    );

    await monitoringAgent.logEvent({
      jobId,
      userId,
      agent: 'parser',
      level: 'success',
      message: `Structured parse complete! Discovered ${(parsedResult.skills?.all || []).length} skills and ${(parsedResult.workExperience || []).length} work history records. Served by [${parsedResult.aiProvider}]`,
      step: 'parse_completed',
      durationMs: Date.now() - startTime,
      metadata: { aiProvider: parsedResult.aiProvider },
    });

    return {
      rawText: text,
      parsedData: parsedResult,
      aiProvider: parsedResult.aiProvider,
      inputCharacters: ['groq', 'deterministic-fallback'].includes(parsedResult.aiProvider) ? text.length : Math.min(text.length, 8000),
    };
  }
}

module.exports = new ParserAgent();
