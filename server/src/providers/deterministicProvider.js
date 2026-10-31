const BaseProvider = require('./baseProvider');
const { extractSkills, hasSkill, normalizeSkill, plain, resumeLines, resumeText, roleId, ROLE_SKILLS } = require('./resumeFacts');

const cleanBullet = (line) => line.trim().replace(/^[•*\-]\s*/, '');
const sectionNames = {
  summary: /^(?:professional\s+)?(?:summary|profile|objective|about me)$/i,
  skills: /^(?:(?:technical|core|key)\s+)?(?:skills|competencies|technologies)$/i,
  experience: /^(?:(?:professional|work|relevant)\s+)?(?:experience|employment|work history)$/i,
  education: /^(?:education|academic background|qualifications)$/i,
  projects: /^(?:(?:personal|key|selected|academic)\s+)?projects$/i,
  certifications: /^(?:certifications?|certificates?|licenses?)$/i,
};
function sections(text) {
  const result = { header: [] };
  let current = 'header';
  text.split(/\r?\n/).forEach((line) => {
    const heading = line.trim().replace(/:$/, '');
    const section = Object.keys(sectionNames).find((name) => sectionNames[name].test(heading));
    if (section) { current = section; result[current] ||= []; }
    else (result[current] ||= []).push(line);
  });
  return result;
}
const blocks = (lines = []) => lines.join('\n').trim().split(/\n\s*\n/).map((block) => block.split('\n').map((line) => line.trim()).filter(Boolean)).filter((block) => block.length);
const dateRange = /((?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{4}|\b(?:19|20)\d{2})\s*(?:-|–|—|to)\s*(Present|Current|Now|(?:(?:[A-Za-z]+)\s+)?(?:19|20)\d{2})/i;

class DeterministicProvider extends BaseProvider {
  constructor() { super('deterministic-fallback'); }
  isAvailable() { return true; }

  async parseResume(rawText = '') {
    const text = String(rawText), parts = sections(text);
    const header = parts.header.map((line) => line.trim()).filter(Boolean), all = extractSkills(text);
    const email = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0] || '';
    const phone = text.match(/\+?\d[\d ()\-.]{8,20}\d/g)?.find((candidate) => {
      const digits = candidate.replace(/\D/g, '').length;
      return digits >= 10 && digits <= 15;
    }) || '';
    const link = (pattern) => text.match(pattern)?.[0] || '';
    const first = header.find((line) => !/^(resume|curriculum vitae|cv)$/i.test(line));
    const name = first && /^[\p{L} .'-]{3,80}$/u.test(first) ? first : '';
    const workExperience = blocks(parts.experience).map((block) => {
      const range = block.join(' ').match(dateRange);
      const title = block[0].replace(dateRange, '').replace(/[|,\s-]+$/, '');
      const identity = title.split(/\s+(?:at|@)\s+|\s+\|\s+|\s+[—–]\s+/i);
      const companyLine = block[1] && !/^[•*\-]/.test(block[1]) && !dateRange.test(block[1]) ? block[1] : '';
      return {
        role: identity[0] || '', company: identity[1] || companyLine,
        startDate: range?.[1] || '', endDate: range?.[2] || '',
        current: /present|current|now/i.test(range?.[2] || ''),
        highlights: block.slice(companyLine ? 2 : 1).map(cleanBullet).filter((line) => line && !dateRange.test(line)),
      };
    });
    return {
      contactInfo: {
        name, email, phone: phone.trim(), location: header.join('\n').match(/(?:^|\n)Location:\s*(.+)/i)?.[1] || '',
        linkedin: link(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+/i),
        github: link(/(?:https?:\/\/)?(?:www\.)?github\.com\/[a-zA-Z0-9_-]+/i),
        portfolio: header.join('\n').match(/Portfolio:\s*(https?:\/\/\S+)/i)?.[1] || '',
      },
      summary: (parts.summary || []).map((line) => line.trim()).filter(Boolean).join(' '),
      skills: { technical: all, soft: [], tools: [], frameworks: [], all }, workExperience,
      education: blocks(parts.education).map((block) => ({
        degree: block[0], institution: block[1] || '', graduationYear: block.join(' ').match(/\b(?:19|20)\d{2}\b/)?.[0] || '',
      })),
      projects: blocks(parts.projects).map((block) => ({
        title: block[0], description: block.slice(1).filter((line) => !/^[•*\-]/.test(line)).join(' '),
        technologies: extractSkills(block.join(' ')), link: block.join(' ').match(/https?:\/\/\S+/)?.[0] || '',
        highlights: block.slice(1).filter((line) => /^[•*\-]/.test(line)).map(cleanBullet),
      })),
      certifications: (parts.certifications || []).map(cleanBullet).filter(Boolean).map((name) => ({ name })),
      warnings: ['Offline extraction uses text headings and a limited skill dictionary. Review extracted fields against the original; unknown facts were left empty.'],
    };
  }

  async tailorResume({ resumeData, targetRole = 'Fullstack Developer', jobDescriptionText = '' }) {
    const original = plain(resumeData);
    const supported = [...new Map([...(original.skills?.all || []), ...Object.values(original.skills || {}).flat()]
      .filter((value) => typeof value === 'string').map((value) => [normalizeSkill(value), value])).values()];
    const requested = [...extractSkills(jobDescriptionText), ...ROLE_SKILLS[roleId(targetRole)]];
    const rank = (value) => requested.reduce((score, skill, index) => score + (hasSkill(value, skill) ? requested.length - index : 0), 0);
    const order = (values = []) => [...values].sort((a, b) => rank(b) - rank(a));
    const modifiedHighlights = [];
    const workExperience = (original.workExperience || []).map((entry) => {
      const highlights = order(entry.highlights);
      if (JSON.stringify(highlights) !== JSON.stringify(entry.highlights || [])) modifiedHighlights.push({
        section: [entry.role, entry.company].filter(Boolean).join(' @ '),
        original: (entry.highlights || []).join('\n'), tailored: highlights.join('\n'),
        reason: 'Prioritized existing evidence relevant to the target role and job description.',
      });
      return { ...entry, highlights };
    });
    return {
      summary: original.summary || '',
      skills: { ...original.skills, technical: order(original.skills?.technical),
        tools: order(original.skills?.tools), frameworks: order(original.skills?.frameworks), all: order(supported) },
      workExperience,
      projects: (original.projects || []).map((project) => ({ ...project, highlights: order(project.highlights) })),
      diffFromOriginal: { addedSkills: [], removedSkills: [], modifiedHighlights,
        summaryDiff: { original: original.summary || '', tailored: original.summary || '' } },
    };
  }

  async scoreATS({ resumeData = {}, rawText = '' }) {
    const contact = resumeData.contactInfo || {}, skills = resumeData.skills?.all || [];
    const experience = resumeData.workExperience || [], education = resumeData.education || [];
    const text = rawText || resumeText(resumeData), wordCount = text.split(/\s+/).filter(Boolean).length;
    const breakdown = [], strengths = [], improvements = [];
    const check = (category, valid, message, points) => {
      breakdown.push({ category, status: valid ? 'pass' : 'warning', message });
      if (!valid) improvements.push(message);
      return valid ? points : 0;
    };
    const structureScore =
      check('Contact Information', Boolean(contact.email && contact.phone), contact.email && contact.phone ? 'Email and phone are present.' : 'Add your actual email and phone.', 25) +
      check('Experience Section', experience.length > 0, experience.length ? 'Work experience is present.' : 'Add relevant experience or clearly labeled projects.', 35) +
      check('Education Section', education.length > 0, education.length ? 'Education is present.' : 'Add your education if relevant.', 20) +
      check('Skills Section', skills.length > 0, skills.length ? 'A skills section is present.' : 'List your verified skills.', 20);
    const keywordScore = Math.min(100, skills.length * 10), formattingScore = text.trim() ? 80 : 0;
    const lengthScore = wordCount >= 300 && wordCount <= 900 ? 100 : wordCount >= 100 && wordCount <= 1200 ? 65 : wordCount ? 30 : 0;
    breakdown.push({ category: 'Text readability', status: text.trim() ? 'pass' : 'fail',
      message: 'Heuristic text assessment; document layout and columns are not verified by this offline score.' });
    if (lengthScore < 100) improvements.push('Review resume length; a concise 300–900 word document is often easier to assess.');
    if (structureScore >= 80) strengths.push('The main resume sections are represented.');
    return { score: Math.round(structureScore * .3 + keywordScore * .35 + formattingScore * .2 + lengthScore * .15),
      structureScore, keywordScore, formattingScore, lengthScore, breakdown, strengths, improvements };
  }

  async analyzeGap({ resumeData = {}, jobDescriptionText = '', targetRole = 'Software Engineer' }) {
    const required = extractSkills(jobDescriptionText), lines = resumeLines(resumeData);
    const actual = new Set((resumeData.skills?.all || []).map(normalizeSkill));
    const matchedSkills = [], mustHaveMissing = [], niceToHaveMissing = [];
    required.forEach((skill) => {
      const evidence = lines.filter((line) => hasSkill(line, skill));
      if (actual.has(normalizeSkill(skill)) || evidence.length) {
        matchedSkills.push({ skill, category: 'JD skill', supportingResumeLines: evidence.slice(0, 3) });
      } else {
        const jdLines = jobDescriptionText.split(/\r?\n|[.;]/).filter((line) => hasSkill(line, skill));
        const optional = jdLines.length && jdLines.every((line) => /preferred|nice.to.have|bonus|optional/i.test(line));
        (optional ? niceToHaveMissing : mustHaveMissing).push({ skill, importance: optional ? 'medium' : 'high',
          recommendation: 'Develop evidence for ' + skill + '; add it only after you have relevant experience.' });
      }
    });
    return {
      matchScore: required.length ? Math.round(matchedSkills.length / required.length * 100) : 0,
      matchedSkills, mustHaveMissing, niceToHaveMissing,
      summaryRecommendations: required.length
        ? ['Assessment for ' + targetRole + ' uses only skills explicitly recognized in the job description.',
          'Review the original JD for requirements outside the offline skill dictionary.']
        : ['No supported skill requirements were recognized. Review the job description manually or use an AI provider.'],
    };
  }

  async generateQuestions({ resumeData = {}, targetRole = 'Fullstack Developer', jobDescriptionText = '', count = 5 }) {
    if (!Number.isInteger(count) || count < 1 || count > 10) throw new Error('Question count must be an integer from 1 to 10');
    const topics = {
      sde: ['algorithm complexity', 'data structures', 'testing edge cases', 'concurrency', 'system design', 'code review', 'debugging', 'trade-offs', 'reliability', 'API design'],
      backend: ['API design', 'transactions', 'database indexing', 'caching', 'message queues', 'authentication', 'observability', 'concurrency', 'failure recovery', 'scaling'],
      frontend: ['component design', 'accessibility', 'state management', 'rendering performance', 'browser security', 'testing', 'responsive layout', 'server rendering', 'forms', 'network failures'],
      fullstack: ['API contracts', 'frontend state', 'database design', 'authentication', 'end-to-end testing', 'deployment', 'observability', 'caching', 'reliability', 'data validation'],
      data: ['data leakage', 'model validation', 'feature engineering', 'data pipelines', 'SQL analysis', 'class imbalance', 'model monitoring', 'reproducibility', 'experiment design', 'data quality'],
      devops: ['deployment rollbacks', 'infrastructure as code', 'container security', 'monitoring', 'incident response', 'CI/CD', 'secrets management', 'capacity planning', 'disaster recovery', 'networking'],
      product: ['product discovery', 'success metrics', 'roadmap prioritization', 'user research', 'A/B testing', 'stakeholder alignment', 'trade-offs', 'delivery risks', 'launch planning', 'feedback analysis'],
    }[roleId(targetRole)];
    const candidates = [...extractSkills(jobDescriptionText), ...(resumeData.skills?.all || []), ...topics];
    const selected = [...new Set(candidates)].slice(0, count), project = resumeData.projects?.[0]?.title;
    return selected.map((topic, index) => {
      const behavioral = index === 2 || index === 6;
      return {
        order: index + 1, category: behavioral ? 'behavioral' : index % 4 === 3 ? 'system_design' : 'role_specific',
        topic, difficulty: index % 4 === 3 ? 'Hard' : 'Medium',
        questionText: behavioral
          ? 'Describe how you handled a challenge involving ' + topic + (project ? ' in ' + project : ' in a project, course or job') + '. Explain your decisions and actual outcome.'
          : 'For a ' + targetRole + ' role, how would you approach ' + topic + '? Explain constraints, trade-offs, validation and failure cases.',
        suggestedAnswer: behavioral
          ? 'Use a real example. Describe the situation and goal, your own actions, alternatives you considered, and the actual result. State what you learned without inventing metrics.'
          : 'Define the goal and constraints for ' + topic + '. Compare practical alternatives, explain your chosen approach and its trade-offs, then discuss validation, monitoring and failure recovery.',
        keyPoints: behavioral ? ['Situation and goal', 'Personal actions', 'Actual result', 'Lessons learned']
          : ['Requirements and constraints', 'Alternatives and trade-offs', 'Validation and testing', 'Failure recovery'],
      };
    });
  }

  async evaluateAnswer({ question = {}, userAnswer = '' }) {
    const text = userAnswer.trim(), words = text.split(/\s+/).filter(Boolean).length;
    const terms = [...new Set((question.keyPoints || []).join(' ').toLowerCase().split(/\W+/).filter((term) => term.length > 3))];
    const overlap = terms.filter((term) => text.toLowerCase().includes(term)).length / Math.max(1, terms.length);
    const star = [/situation|context|project/i, /task|goal|needed/i, /action|implemented|built|developed/i, /result|outcome|improved|learned/i].filter((pattern) => pattern.test(text)).length;
    const clarityScore = words < 5 ? 20 : Math.min(90, 40 + words);
    const relevanceScore = words < 5 ? 20 : Math.round(30 + overlap * 60);
    const structureScore = words < 5 ? 20 : question.category === 'behavioral' ? 20 + star * 18 : Math.min(90, 35 + words);
    const technicalScore = words < 5 ? 20 : Math.round(25 + overlap * 60);
    return {
      clarityScore, relevanceScore, structureScore, technicalScore,
      overallScore: Math.round((clarityScore + relevanceScore + structureScore + technicalScore) / 4),
      strengths: overlap >= .4 ? ['The answer includes several rubric concepts.'] : [],
      improvements: words < 40 ? ['Add specific reasoning, alternatives, and evidence.'] : ['Check technical accuracy and address failure cases.'],
      starAdherence: question.category === 'behavioral' ? star + '/4 STAR elements recognized' : 'Not applicable',
      comments: 'Offline feedback measures length, rubric terms and structure. It cannot verify technical correctness; review against the model answer.',
    };
  }
}
module.exports = DeterministicProvider;
