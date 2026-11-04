const BaseProvider = require('./baseProvider');
const { extractSkills, hasSkill, normalizeSkill, plain, roleId, ROLE_SKILLS } = require('./resumeFacts');
const { contactName } = require('./resumeContact');

const cleanBullet = (line) => line.trim().replace(/^[•*\-]\s*/, '');
const sectionNames = {
  summary: ['summary', 'profile', 'objective', 'about me'].flatMap((label) => [label, 'professional ' + label]),
  skills: ['skills', 'competencies', 'technologies'].flatMap((label) => [label, ...['technical', 'core', 'key'].map((prefix) => prefix + ' ' + label)]),
  experience: ['experience', 'employment', 'work history'].flatMap((label) => [label, ...['professional', 'work', 'relevant'].map((prefix) => prefix + ' ' + label)]),
  education: ['education', 'academic background', 'qualifications'],
  projects: ['project', 'projects', 'personal projects', 'key projects', 'selected projects', 'academic projects'],
  certifications: ['certification', 'certifications', 'certificate', 'certificates', 'license', 'licenses'],
};
const compactHeading = (value) => value.toLowerCase().replace(/\s+/gu, '');
const headingSections = new Map(Object.entries(sectionNames).flatMap(([section, labels]) => labels.map((label) => [compactHeading(label), section])));
const sectionForHeading = (value) => headingSections.get(compactHeading(value.trim().replace(/:$/, '')));
const inlineHeading = new RegExp('^\\s*(' + [...headingSections.keys()].map((label) => [...label].join('[ \\t\\u00a0]*')).join('|')
  + ')(?:\\s*[:|｜]\\s*|\\t+|\\s+[—–-](?:\\s+|$))(.*)$', 'i');
function sections(text) {
  const result = { header: [] };
  let current = 'header';
  text.split(/\r?\n/).forEach((line) => {
    // Normalize only a recognized whole heading; keep every body line verbatim for citations.
    const section = sectionForHeading(line);
    if (section) { current = section; result[current] ||= []; }
    else {
      const inline = line.match(inlineHeading);
      if (inline) {
        current = sectionForHeading(inline[1]);
        // Retain the full payload, including negation/instructions and separators, before evidence filtering.
        result[current] ||= [];
        if (inline[2].trim()) result[current].push(inline[2]);
      } else (result[current] ||= []).push(line);
    }
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
    const { resumeEvidence, negative } = require('../services/requirementMatching');
    const { instruction } = require('../services/jobRequirements');
    const usable = (line) => !instruction.test(line) && !negative(line) && !/\b(?:required|preferred|must[ -]have)\b/i.test(line);
    const header = parts.header.map((line) => line.trim()).filter(Boolean);
    const email = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0] || '';
    const phone = text.match(/\+?\d[\d ()\-.]{8,20}\d/g)?.find((candidate) => {
      const digits = candidate.replace(/\D/g, '').length;
      return digits >= 10 && digits <= 15;
    }) || '';
    const link = (pattern) => text.match(pattern)?.[0] || '';
    const name = contactName(header);
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
    const parsed = {
      contactInfo: {
        name, email, phone: phone.trim(), location: header.join('\n').match(/(?:^|\n)Location:\s*(.+)/i)?.[1] || '',
        linkedin: link(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+/i),
        github: link(/(?:https?:\/\/)?(?:www\.)?github\.com\/[a-zA-Z0-9_-]+/i),
        portfolio: header.join('\n').match(/Portfolio:\s*(https?:\/\/\S+)/i)?.[1] || '',
      },
      summary: (parts.summary || []).map((line) => line.trim()).filter(Boolean).join(' '),
      skills: { technical: [], soft: [], tools: [], frameworks: [], all: [] }, workExperience,
      education: blocks(parts.education).map((block) => ({
        degree: block[0], institution: block[1] || '', graduationYear: block.join(' ').match(/\b(?:19|20)\d{2}\b/)?.[0] || '',
      })),
      projects: blocks(parts.projects).map((block) => ({
        title: block[0], description: block.slice(1).filter((line) => !/^[•*\-]/.test(line)).join(' '),
        technologies: extractSkills(block.filter(usable).join(' ')), link: block.join(' ').match(/https?:\/\/\S+/)?.[0] || '',
        highlights: block.slice(1).filter((line) => /^[•*\-]/.test(line)).map(cleanBullet),
      })),
      certifications: (parts.certifications || []).map(cleanBullet).filter(Boolean).map((name) => ({ name })),
      warnings: ['Offline extraction uses text headings and a limited skill dictionary. Review extracted fields against the original; unknown facts were left empty.'],
    };
    // Contact/employer names and source instructions cannot establish candidate skills.
    const skillLines = parts.skills || [];
    const sources = [...resumeEvidence(parsed).map((item) => item.quote), ...skillLines]
      .filter(usable);
    const all = extractSkills(sources.join('\n'));
    parsed.skills = { technical: all, soft: [], tools: [], frameworks: [], all };
    return parsed;
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

  async scoreATS(params) { return require('../services/assessmentRubrics').assessResume(params); }

  async analyzeGap(params) { return require('../services/requirementMatching').assessMatch(params); }

  async generateQuestions({ resumeData = {}, targetRole = 'Fullstack Developer', jobDescriptionText = '', count = 5, difficulty = 'Medium', topicFocus = '' }) {
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
    const candidates = topicFocus ? Array.from({ length: count }, (_, index) => topicFocus + [' fundamentals', ' implementation', ' trade-offs', ' debugging', ' testing', ' scaling', ' security', ' failure recovery', ' design review', ' real examples'][index]) : [...extractSkills(jobDescriptionText), ...(resumeData.skills?.all || []), ...topics];
    const selected = [...new Set(candidates)].slice(0, count), project = resumeData.projects?.[0]?.title;
    return selected.map((topic, index) => {
      const behavioral = index === 2 || index === 6;
      return {
        order: index + 1, category: behavioral ? 'behavioral' : index % 4 === 3 ? 'system_design' : 'role_specific',
        topic: topicFocus || topic, difficulty,
        questionText: behavioral
          ? 'Describe how you handled a challenge involving ' + topic + (project ? ' in ' + project : ' in a project, course or job') + '. Explain your decisions and actual outcome.'
          : 'For a ' + targetRole + ' role, how would you approach ' + topic + '? ' + (difficulty === 'Easy' ? 'Explain the basic steps and give a simple example.' : difficulty === 'Hard' ? 'Evaluate production scale constraints, competing trade-offs, validation and failure recovery.' : 'Explain constraints, trade-offs, validation and failure cases.'),
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
