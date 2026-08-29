const axios = require('axios');
const BaseProvider = require('./baseProvider');
const env = require('../config/env');

class OpenRouterProvider extends BaseProvider {
  constructor() {
    super('openrouter');
    this.apiKey = env.OPENROUTER_API_KEY;
    this.model = env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free';
    this.baseUrl = 'https://openrouter.ai/api/v1/chat/completions';
  }

  isAvailable() {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  async _callOpenRouter(systemPrompt, userPrompt) {
    const response = await axios.post(
      this.baseUrl,
      {
        model: this.model,
        messages: [
          { role: 'system', content: `${systemPrompt}\nRespond in valid JSON only without markdown code blocks.` },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      },
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://careerforge-ai.dev',
          'X-Title': 'CareerForge AI Platform',
          'Content-Type': 'application/json',
        },
        timeout: 45000,
      }
    );

    const content = response.data?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response received from OpenRouter API');
    }

    try {
      const cleanJson = content.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
      return JSON.parse(cleanJson);
    } catch (parseError) {
      throw new Error(`OpenRouter JSON parsing error: ${parseError.message}`);
    }
  }

  async parseResume(rawText) {
    const systemPrompt = `You are an expert resume parsing AI. Extract structured JSON strictly matching:
{
  "contactInfo": { "name": "", "email": "", "phone": "", "location": "", "linkedin": "", "github": "", "portfolio": "" },
  "summary": "",
  "skills": { "technical": [], "soft": [], "tools": [], "frameworks": [], "all": [] },
  "workExperience": [ { "role": "", "company": "", "location": "", "startDate": "", "endDate": "", "current": false, "highlights": [] } ],
  "education": [ { "degree": "", "institution": "", "fieldOfStudy": "", "graduationYear": "", "score": "" } ],
  "projects": [ { "title": "", "description": "", "technologies": [], "link": "", "highlights": [] } ],
  "certifications": [ { "name": "", "issuer": "", "year": "" } ]
}`;
    return this._callOpenRouter(systemPrompt, `Extract structured data from this resume text:\n\n${rawText.slice(0, 8000)}`);
  }

  async scoreATS({ resumeData, rawText }) {
    const systemPrompt = `You are an ATS (Applicant Tracking System) expert evaluator. Analyze the resume and return JSON:
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
    return this._callOpenRouter(systemPrompt, `Score this parsed resume:\n${JSON.stringify(resumeData).slice(0, 6000)}`);
  }

  async tailorResume({ resumeData, targetRole, jobDescriptionText }) {
    const systemPrompt = `You are an executive resume coach. Tailor the resume for target role "${targetRole}". Return JSON:
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
    return this._callOpenRouter(systemPrompt, `Target Role: ${targetRole}\nJD (Optional): ${jobDescriptionText || 'Standard industry requirements'}\nResume:\n${JSON.stringify(resumeData).slice(0, 6000)}`);
  }

  async analyzeGap({ resumeData, jobDescriptionText, targetRole }) {
    const systemPrompt = `You are a recruitment gap analysis agent. Compare resume against JD for "${targetRole}". Return JSON:
{
  "matchScore": 0-100,
  "matchedSkills": [ { "skill": "", "category": "", "supportingResumeLines": [] } ],
  "mustHaveMissing": [ { "skill": "", "importance": "high", "recommendation": "" } ],
  "niceToHaveMissing": [ { "skill": "", "importance": "medium", "recommendation": "" } ],
  "summaryRecommendations": []
}`;
    return this._callOpenRouter(systemPrompt, `Job Description:\n${jobDescriptionText.slice(0, 4000)}\n\nResume Data:\n${JSON.stringify(resumeData).slice(0, 4000)}`);
  }

  async generateQuestions({ resumeData, targetRole, jobDescriptionText, count = 5 }) {
    const systemPrompt = `You are a Principal Hiring Manager. Generate ${count} interview questions for "${targetRole}". Return JSON:
{
  "questions": [
    {
      "order": 1,
      "questionText": "",
      "category": "technical" | "behavioral" | "role_specific" | "system_design",
      "topic": "",
      "difficulty": "Easy" | "Medium" | "Hard",
      "suggestedAnswer": "Comprehensive model answer",
      "keyPoints": []
    }
  ]
}`;
    const result = await this._callOpenRouter(systemPrompt, `Target Role: ${targetRole}\nResume Skills: ${(resumeData?.skills?.all || []).join(', ')}\nJD: ${jobDescriptionText || 'Standard requirements'}`);
    return result.questions || [];
  }

  async evaluateAnswer({ question, userAnswer, suggestedAnswer, targetRole }) {
    const systemPrompt = `You are an interview assessor. Evaluate the user's answer against the question rubric and return JSON:
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
    return this._callOpenRouter(systemPrompt, `Question (${question.category}): ${question.questionText}\nSuggested Answer: ${suggestedAnswer}\nCandidate Answer: ${userAnswer}`);
  }
}

module.exports = OpenRouterProvider;
