const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const providerFactory = require('../providers/providerFactory');
const monitoringAgent = require('./monitoringAgent');

class ParserAgent {
  /**
   * Extract raw text from file buffer based on mimetype or fileType
   */
  async extractTextFromBuffer(buffer, fileType = 'pdf') {
    const type = fileType.toLowerCase();

    if (type.includes('pdf')) {
      try {
        const data = await pdfParse(buffer);
        return data.text || '';
      } catch (err) {
        throw new Error(`PDF text extraction error: ${err.message}`);
      }
    }

    if (type.includes('doc') || type.includes('docx') || type.includes('word')) {
      try {
        const result = await mammoth.extractRawText({ buffer });
        return result.value || '';
      } catch (err) {
        throw new Error(`DOCX text extraction error: ${err.message}`);
      }
    }

    // Default plain text utf-8
    return buffer.toString('utf-8');
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
    };
  }
}

module.exports = new ParserAgent();
