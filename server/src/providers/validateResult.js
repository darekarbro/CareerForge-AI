const { normalizeSkill } = require('./resumeFacts');
const { preservesResumeDetail } = require('./resumeWriting');
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const strings = (value) => Array.isArray(value) && value.every((item) => typeof item === 'string');
const score = (value) => Number.isFinite(value) && value >= 0 && value <= 100;
const entries = (value, required) => Array.isArray(value) && value.every((item) => object(item) &&
  required.every((key) => typeof item[key] === 'string'));
function validateResult(action, result, params) {
  let valid = object(result);
  if (action === 'parseResume') valid = valid && object(result.contactInfo) &&
    typeof result.contactInfo.name === 'string' && typeof result.contactInfo.email === 'string' &&
    typeof result.summary === 'string' && strings(result.skills?.all) &&
    entries(result.workExperience, ['role', 'company']) && entries(result.education, ['degree', 'institution']) &&
    entries(result.projects, ['title']) && entries(result.certifications, ['name']);
  if (action === 'tailorResume') {
    const original = new Set(Object.values(params.resumeData?.skills || {}).flat()
      .filter((value) => typeof value === 'string').map(normalizeSkill));
    valid = valid && typeof result.summary === 'string' && strings(result.skills?.all) &&
      result.skills.all.every((skill) => original.has(normalizeSkill(skill))) &&
      entries(result.workExperience, ['role', 'company']) && entries(result.projects, ['title']) &&
      object(result.diffFromOriginal) && strings(result.diffFromOriginal.addedSkills) &&
      result.diffFromOriginal.addedSkills.length === 0 && preservesResumeDetail(result, params.resumeData);
  }
  if (action === 'scoreATS') valid = valid && ['score', 'formattingScore', 'structureScore', 'keywordScore', 'lengthScore'].every((key) => score(result[key])) &&
    entries(result.breakdown, ['category', 'message', 'status']) &&
    result.breakdown.every((item) => ['pass', 'warning', 'fail'].includes(item.status)) &&
    strings(result.strengths) && strings(result.improvements);
  if (action === 'analyzeGap') valid = valid && score(result.matchScore) &&
    entries(result.matchedSkills, ['skill', 'category']) &&
    result.matchedSkills.every((item) => strings(item.supportingResumeLines)) &&
    entries(result.mustHaveMissing, ['skill', 'recommendation']) &&
    entries(result.niceToHaveMissing, ['skill', 'recommendation']) && strings(result.summaryRecommendations);
  if (action === 'generateQuestions') {
    valid = Array.isArray(result) && result.length === (params.count ?? 5) &&
      result.every((item) => object(item) && typeof item.questionText === 'string' && item.questionText.trim() &&
        typeof item.suggestedAnswer === 'string' && item.suggestedAnswer.trim() && typeof item.topic === 'string' &&
        ['technical', 'behavioral', 'role_specific', 'system_design'].includes(item.category) &&
        ['Easy', 'Medium', 'Hard'].includes(item.difficulty) && strings(item.keyPoints));
  }
  if (action === 'evaluateAnswer') valid = valid &&
    ['clarityScore', 'relevanceScore', 'structureScore', 'technicalScore', 'overallScore'].every((key) => score(result[key])) &&
    strings(result.strengths) && strings(result.improvements) && typeof result.comments === 'string';
  if (!valid) throw new Error('Invalid provider schema for ' + action);
  return result;
}
module.exports = { validateResult };
