// Strict Structured Outputs requires every object field and forbids extra properties.
const text = { type: 'string' };
const strings = { type: 'array', items: text };
const object = (properties) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const list = (items) => ({ type: 'array', items });
const score = { type: 'number', minimum: 0, maximum: 100 };
const skills = object({ technical: strings, soft: strings, tools: strings, frameworks: strings, all: strings });
const experience = list(object({ role: text, company: text, location: text, startDate: text,
  endDate: text, current: { type: 'boolean' }, highlights: strings }));
const projects = list(object({ title: text, description: text, technologies: strings, link: text, highlights: strings }));
const missing = list(object({ skill: text, importance: text, recommendation: text }));
module.exports = {
  parseResume: object({
    contactInfo: object({ name: text, email: text, phone: text, location: text, linkedin: text, github: text, portfolio: text }),
    summary: text, skills, workExperience: experience,
    education: list(object({ degree: text, institution: text, fieldOfStudy: text, graduationYear: text, score: text })),
    projects, certifications: list(object({ name: text, issuer: text, year: text })),
  }),
  tailorResume: object({
    summary: text, skills, workExperience: experience, projects,
    diffFromOriginal: object({ addedSkills: strings, removedSkills: strings,
      modifiedHighlights: list(object({ section: text, original: text, tailored: text, reason: text })),
      summaryDiff: object({ original: text, tailored: text }) }),
  }),
  scoreATS: object({ score, formattingScore: score, structureScore: score, keywordScore: score, lengthScore: score,
    breakdown: list(object({ category: text, status: { type: 'string', enum: ['pass', 'warning', 'fail'] }, message: text })),
    strengths: strings, improvements: strings }),
  analyzeGap: object({ matchScore: score,
    matchedSkills: list(object({ skill: text, category: text, supportingResumeLines: strings })),
    mustHaveMissing: missing, niceToHaveMissing: missing, summaryRecommendations: strings }),
  generateQuestions: object({ questions: list(object({ order: { type: 'integer' }, questionText: text,
    category: { type: 'string', enum: ['technical', 'behavioral', 'role_specific', 'system_design'] },
    topic: text, difficulty: { type: 'string', enum: ['Easy', 'Medium', 'Hard'] },
    suggestedAnswer: text, keyPoints: strings })) }),
  evaluateAnswer: object({ clarityScore: score, relevanceScore: score, structureScore: score, technicalScore: score,
    overallScore: score, strengths: strings, improvements: strings, starAdherence: text, comments: text }),
};
