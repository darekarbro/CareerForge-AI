const BaseProvider = require('./baseProvider');
const { extractSkills, hasSkill, normalizeSkill, plain, roleId, ROLE_SKILLS } = require('./resumeFacts');
const { contactDetails } = require('./resumeContact');
const { reconcileSkillConflicts, conflictWarnings } = require('./skillConflicts');
const { splitResumeSections, claimParagraphs } = require('./resumeLayout');
const { analyzeSkillClaims } = require('./resumeClaims');
const { resumeText } = require('./resumeFacts');
const { splitClaimClauses } = require('./skillPolarity');

const cleanBullet = (line) => line.trim().replace(/^[•*\-]\s*/, '');
const blocks = (lines = []) => lines.join('\n').trim().split(/\n\s*\n/).map((block) => block.split('\n').map((line) => line.trim()).filter(Boolean)).filter((block) => block.length);
const dateRange = /((?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{4}|\b(?:19|20)\d{2})\s*(?:-|–|—|to)\s*(Present|Current|Now|(?:(?:[A-Za-z]+)\s+)?(?:19|20)\d{2})/i;

class DeterministicProvider extends BaseProvider {
  constructor() { super('deterministic-fallback'); }
  isAvailable() { return true; }

  async parseResume(rawText = '') {
    const text = String(rawText), { parts, statements } = splitResumeSections(text);
    const positiveSkills = (lines, context = 'narrative') => extractSkills(lines.flatMap((line) => analyzeSkillClaims(line, { context }).positiveSkills).join('\n'));
    const header = parts.header.map((line) => line.trim()).filter(Boolean);
    const { name, email } = contactDetails(text.split(/\r?\n/));
    const phone = text.match(/\+?\d[\d ()\-.]{8,20}\d/g)?.find((candidate) => {
      const digits = candidate.replace(/\D/g, '').length;
      return digits >= 10 && digits <= 15;
    }) || '';
    const link = (pattern) => text.match(pattern)?.[0] || '';
    const workExperience = blocks(parts.experience).map((block) => {
      const range = block.join(' ').match(dateRange);
      const title = block[0].replace(dateRange, '').replace(/[|,\s-]+$/, '');
      const identity = title.split(/\s+(?:at|@)\s+|\s+\|\s+|\s+[—–]\s+/i);
      const companyLine = block[1] && !/^[•*\-]|\b(?:I|we)\b|^(?:built|wrote|developed|implemented|used|using|reviewed|maintained)\b/i.test(block[1]) && !dateRange.test(block[1]) ? block[1] : '';
      return {
        role: identity[0] || '', company: identity[1] || companyLine,
        startDate: range?.[1] || '', endDate: range?.[2] || '',
        current: /present|current|now/i.test(range?.[2] || ''),
        highlights: splitClaimClauses(block.slice(companyLine ? 2 : 1).join('\n')).map(cleanBullet).filter((line) => line && !dateRange.test(line)),
      };
    });
    const parsed = {
      contactInfo: {
        name, email, phone: phone.trim(), location: header.join('\n').match(/(?:^|\n)Location:\s*(.+)/i)?.[1] || '',
        linkedin: link(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+/i),
        github: link(/(?:https?:\/\/)?(?:www\.)?github\.com\/[a-zA-Z0-9_-]+/i),
        portfolio: header.join('\n').match(/Portfolio:\s*(https?:\/\/\S+)/i)?.[1] || '',
      },
      summary: (parts.summary || []).map((line) => line.trim()).filter(Boolean).join('\n'),
      skills: { technical: [], soft: [], tools: [], frameworks: [], all: [] }, workExperience,
      education: blocks(parts.education).map((block) => ({
        degree: block[0], institution: block[1] || '', graduationYear: block.join(' ').match(/\b(?:19|20)\d{2}\b/)?.[0] || '',
      })),
      projects: blocks(parts.projects).map((block) => ({
        title: block[0], description: splitClaimClauses(block.slice(1).join('\n')).filter((line) => !/^[•*\-]/.test(line)).join('\n'),
        technologies: positiveSkills([block.join('\n')]), link: block.join(' ').match(/https?:\/\/\S+/)?.[0] || '',
        highlights: splitClaimClauses(block.slice(1).join('\n')).filter((line) => /^[•*\-]/.test(line)).map(cleanBullet),
      })),
      certifications: (parts.certifications || []).map(cleanBullet).filter(Boolean).map((name) => ({ name })),
      warnings: ['Offline extraction uses source statements and a limited skill dictionary. Review extracted fields against the original; unknown facts were left empty.'],
    };
    const companies = new Set(workExperience.map(entry => entry.company).filter(Boolean));
    const institutions = new Set(parsed.education.map(entry => entry.institution).filter(Boolean));
    const eligibleStatements = statements.filter(item => !(item.context === 'unknown' && item.text === name)
      && !(item.section === 'experience' && companies.has(item.text))
      && !(item.section === 'education' && institutions.has(item.text)));
    const claims = claimParagraphs(text, eligibleStatements).map((item) => ({ ...item, ...analyzeSkillClaims(item.text, { context: item.context }) }));
    // Preserve eligible unmapped statements verbatim, including denials in a skill section.
    // This keeps evidence reviewable even when a nonstandard layout cannot be placed confidently.
    const retained = [];
    for (const item of claims) for (const quote of item.candidateText) {
      if ((item.context !== 'skills' || item.deniedSkills.length) && !resumeText(parsed).includes(quote) && !retained.includes(quote)) retained.push(quote);
    }
    if (retained.length) {
      parsed.summary = [parsed.summary, ...retained].filter(Boolean).join('\n');
      parsed.warnings.push('Some source statements were retained verbatim in the summary. Review imported section placement.');
    }
    const all = extractSkills(claims.flatMap((item) => item.positiveSkills).join('\n'));
    parsed.skills = { technical: all, soft: [], tools: [], frameworks: [], all };
    const reconciled = reconcileSkillConflicts(parsed, claims.flatMap((item) => item.candidateText));
    reconciled.warnings = conflictWarnings(reconciled, reconciled.warnings);
    return reconciled;
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
