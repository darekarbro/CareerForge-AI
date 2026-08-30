const axios = require('axios');
const BaseProvider = require('./baseProvider');
const env = require('../config/env');
const { requestWithTimeout } = require('./requestWithTimeout');

class GeminiProvider extends BaseProvider {
  constructor() {
    super('gemini');
    this.apiKey = env.GEMINI_API_KEY;
    this.model = env.GEMINI_MODEL || 'gemini-2.0-flash';
  }

  isAvailable() {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  async _callGemini(prompt) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
    
    const response = await requestWithTimeout(
      (signal) => axios.post(
        url,
        {
          contents: [
            {
              parts: [{ text: `${prompt}\n\nStrict requirement: Output valid raw JSON only without markdown code blocks or explanations.` }],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
          },
        },
        {
          headers: { 'Content-Type': 'application/json' },
          signal,
          timeout: env.AI_PROVIDER_TIMEOUT_MS,
        }
      ),
      env.AI_PROVIDER_TIMEOUT_MS,
      'Gemini'
    );

    const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('Empty response from Google Gemini API');
    }

    try {
      const cleanJson = text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
      return JSON.parse(cleanJson);
    } catch (err) {
      throw new Error(`Gemini JSON parsing error: ${err.message}`);
    }
  }

  async parseResume(rawText) {
    const prompt = `Parse the following resume text into structured JSON:
{
  "contactInfo": { "name": "", "email": "", "phone": "", "location": "", "linkedin": "", "github": "", "portfolio": "" },
  "summary": "",
  "skills": { "technical": [], "soft": [], "tools": [], "frameworks": [], "all": [] },
  "workExperience": [ { "role": "", "company": "", "location": "", "startDate": "", "endDate": "", "current": false, "highlights": [] } ],
  "education": [ { "degree": "", "institution": "", "fieldOfStudy": "", "graduationYear": "", "score": "" } ],
  "projects": [ { "title": "", "description": "", "technologies": [], "link": "", "highlights": [] } ],
  "certifications": [ { "name": "", "issuer": "", "year": "" } ]
}
Resume content:
${rawText.slice(0, 8000)}`;
    return this._callGemini(prompt);
  }

  async scoreATS({ resumeData, rawText }) {
    const prompt = `Perform comprehensive ATS scoring on this resume data:
${JSON.stringify(resumeData).slice(0, 6000)}

Return JSON:
{
  "score": 0-100,
  "formattingScore": 0-100,
  "structureScore": 0-100,
  "keywordScore": 0-100,
  "lengthScore": 0-100,
  "breakdown": [ { "category": "", "status": "pass"|"warning"|"fail", "message": "" } ],
  "strengths": [],
  "improvements": []
}`;
    return this._callGemini(prompt);
  }

  async tailorResume({ resumeData, targetRole, jobDescriptionText }) {
    const prompt = `Tailor this resume for the role "${targetRole}".
JD (if provided): ${jobDescriptionText || 'Standard industry expectations'}
Resume: ${JSON.stringify(resumeData).slice(0, 6000)}

Return JSON:
{
  "summary": "tailored summary",
  "skills": { "technical": [], "tools": [], "frameworks": [], "all": [] },
  "workExperience": [ { "role": "", "company": "", "location": "", "startDate": "", "endDate": "", "current": false, "highlights": [] } ],
  "projects": [ { "title": "", "description": "", "technologies": [], "link": "", "highlights": [] } ],
  "diffFromOriginal": {
    "addedSkills": [],
    "removedSkills": [],
    "modifiedHighlights": [ { "section": "", "original": "", "tailored": "", "reason": "" } ],
    "summaryDiff": { "original": "", "tailored": "" }
  }
}`;
    return this._callGemini(prompt);
  }

  async analyzeGap({ resumeData, jobDescriptionText, targetRole }) {
    const prompt = `Analyze gaps between candidate resume and JD for "${targetRole}":
JD: ${jobDescriptionText.slice(0, 4000)}
Resume: ${JSON.stringify(resumeData).slice(0, 4000)}

Return JSON:
{
  "matchScore": 0-100,
  "matchedSkills": [ { "skill": "", "category": "", "supportingResumeLines": [] } ],
  "mustHaveMissing": [ { "skill": "", "importance": "high", "recommendation": "" } ],
  "niceToHaveMissing": [ { "skill": "", "importance": "medium", "recommendation": "" } ],
  "summaryRecommendations": []
}`;
    return this._callGemini(prompt);
  }

  async generateQuestions({ resumeData, targetRole, jobDescriptionText, count = 5 }) {
    const prompt = `Generate ${count} interview questions for role "${targetRole}".
Candidate Skills: ${(resumeData?.skills?.all || []).join(', ')}

Return JSON:
{
  "questions": [
    {
      "order": 1,
      "questionText": "",
      "category": "technical" | "behavioral" | "role_specific" | "system_design",
      "topic": "",
      "difficulty": "Easy" | "Medium" | "Hard",
      "suggestedAnswer": "Detailed model answer",
      "keyPoints": []
    }
  ]
}`;
    const result = await this._callGemini(prompt);
    return result.questions || [];
  }

  async evaluateAnswer({ question, userAnswer, suggestedAnswer, targetRole }) {
    const prompt = `Evaluate candidate mock interview response:
Question (${question.category}): ${question.questionText}
Model Answer: ${suggestedAnswer}
Candidate Response: ${userAnswer}

Return JSON:
{
  "clarityScore": 0-100,
  "relevanceScore": 0-100,
  "structureScore": 0-100,
  "technicalScore": 0-100,
  "overallScore": 0-100,
  "strengths": [],
  "improvements": [],
  "starAdherence": "",
  "comments": ""
}`;
    return this._callGemini(prompt);
  }
}

module.exports = GeminiProvider;
