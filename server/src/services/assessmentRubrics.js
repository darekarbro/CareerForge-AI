const { extractSkills, resumeText, normalizeSkill, plain } = require('../providers/resumeFacts');
const { refreshSkillConflicts } = require('../providers/skillConflicts');

const rubricVersion = 'careerforge-assessment-v3';
const modelVersion = 'assessment-rules-v3';
const commonLimitations = [
  'Scores describe evidence in the supplied resume, not verified competence, hiring probability or an employer ATS result.',
  'Extraction errors, missing context and a limited English skill dictionary can change the result. Review the original documents.',
  'Candidate statements are self-reported. Protected characteristics and contact identity do not affect job matching.',
];
function rubric(kind) {
  return { version: rubricVersion, kind, scoringMethod: 'versioned-local-rules', limitations: [...commonLimitations,
    ...(kind === 'resume-quality' ? [
      'Text readability does not inspect document layout, columns, images or PDF reading order.',
      'The skills and length checks are editing prompts; they do not reward keyword stuffing or establish seniority.',
    ] : [
      'Missing evidence is not evidence that a candidate lacks a skill. Constraints and ambiguous experience require confirmation.',
      'Unclassified requirements and alternative qualifications need manual review; the score is an evidence-coverage estimate.',
    ])] };
}

function assessResume({ resumeData = {} } = {}) {
  const data = refreshSkillConflicts(plain(resumeData), resumeData), contact = data.contactInfo || {};
  const text = resumeText(data), wordCount = text.split(/\s+/).filter(Boolean).length;
  const breakdown = [], strengths = [], improvements = [];
  const check = (category, valid, good, missing, points) => {
    breakdown.push({ category, status: valid ? 'pass' : 'warning', message: valid ? good : missing });
    if (!valid) improvements.push(missing);
    return valid ? points : 0;
  };
  const structureScore = check('Contact Information', Boolean(contact.email && contact.phone), 'Email and phone are present.', 'Add your actual email and phone.', 25)
    + check('Experience Section', Boolean(data.workExperience?.length || data.projects?.length), 'Work experience or projects are present.', 'Add relevant experience or clearly labeled projects.', 35)
    + check('Education Section', Boolean(data.education?.length), 'Education is present.', 'Add your education if relevant.', 20)
    + check('Skills Section', Boolean(Object.values(data.skills || {}).flat().some((item) => typeof item === 'string' && item.trim())), 'A skills section is present.', 'List your verified skills.', 20);
  const uniqueSkills = new Set(Object.values(data.skills || {}).flat().filter((item) => typeof item === 'string').map(normalizeSkill));
  const recognizedSkills = extractSkills([...uniqueSkills].join('\n'));
  const keywordScore = Math.min(100, recognizedSkills.length * 10), formattingScore = text.trim() ? 80 : 0;
  const lengthScore = wordCount >= 300 && wordCount <= 900 ? 100 : wordCount >= 100 && wordCount <= 1200 ? 65 : wordCount ? 30 : 0;
  breakdown.push({ category: 'Text readability', status: text.trim() ? 'pass' : 'fail', message: 'Heuristic text assessment; document layout and columns are not verified.' });
  if (lengthScore < 100) improvements.push('Review length in context: 300–900 words is a prompt, not a universal requirement; concise graduate resumes can be appropriate.');
  if (structureScore >= 80) strengths.push('The main resume sections are represented; projects can substitute for employment.');
  return { score: Math.round(structureScore * .3 + keywordScore * .35 + formattingScore * .2 + lengthScore * .15),
    structureScore, keywordScore, formattingScore, lengthScore, breakdown, strengths, improvements,
    rubric: { ...rubric('resume-quality'), weights: { structure: .3, listedSkills: .35, textReadability: .2, length: .15 },
      uncertainty: { level: 'limited', reason: 'Heuristics evaluate available text only; no calibrated confidence interval is available.' } } };
}
module.exports = { rubricVersion, modelVersion, rubric, assessResume };
