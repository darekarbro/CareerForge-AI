const { normalizeSkill, resumeText, extractSkills, hasSkill } = require('./resumeFacts');

const parsingInstructions = `Extract a detailed structured resume. Preserve each supplied job, project, education record, certification, technology and distinct accomplishment. Keep the full meaning of experience/project bullets, including methods, scope and stated results. Do not merge unrelated projects or replace several achievements with a generic sentence. Copy names, dates, links and metrics accurately; unknown facts remain empty.`;

const tailoringInstructions = `Write a complete, detailed professional resume using only the supplied candidate evidence.
- Write a focused 3-4 sentence professional summary when the evidence supports it: role/technical focus; a specific system or project and personal contribution; an actual result; and relevant collaboration when supplied. A sparse source warrants a shorter summary. Prefer concrete evidence over phrases such as "proven ability", "results-driven" or "passionate". Do not infer seniority or years of experience.
- Retain EVERY supplied job, project and verified skill. Preserve job titles, employers, dates, locations, project titles, links and technologies. Prioritize relevant evidence without removing other qualifications.
- Retain at least the original number of distinct bullets for each job and project. Improve each bullet with a precise action, what was built/improved, the stated approach or tools, and the stated outcome. Aim for 20-40 words only when the source contains these details; keep concise facts concise rather than adding unsupported context or repetition.
- Develop project descriptions into 2-3 clear sentences only when supported: problem/purpose, the candidate's contribution, implementation details and actual result. Keep individual project achievements as separate bullets.
- Never invent responsibilities, architectures, deployment practices, team sizes, outcomes, percentages, durations or other numbers. A job description guides emphasis; it is not evidence that the candidate has a skill or achievement. Do not derive new metrics or years from dates. addedSkills must be empty.
- Preserve what each number measures: working with three developers does not establish a three-person team. Keep the original relationship and scope when rewriting quantitative details.
- Do not infer implementation mechanisms from a feature or technology: authenticated routes do not establish JWT, OAuth or middleware; tests do not establish Jest or CI/CD. Mention a technology or method in a job/project only when that specific source entry supports it. Skills listed elsewhere are not evidence of their use in that entry.
- Group existing skills into technical, frameworks, tools and soft; skills.all must retain the complete supplied skill set. Do not add placeholder achievements or unsupported keywords.
- Include accurate before/after diffs for rewritten experience AND project bullets. Copy the source bullet into original, its actual rewritten text into tailored, and explain the change. Preserve stated numerical results.
- Do not compress the supplied material into a short profile or discard detail to meet a one-page limit. Return EVERY JSON key shown, including empty arrays. Both addedSkills and removedSkills must be [].`;

const same = (a, b) => String(a || '').trim().replace(/\s+/g, ' ').toLowerCase() === String(b || '').trim().replace(/\s+/g, ' ').toLowerCase();
const numberWords = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
const numbers = (text) => new Set(String(text).replace(/(?<=\d),(?=\d)/g, '')
  .replace(new RegExp('\\b(' + numberWords.join('|') + ')\\b', 'gi'), (word) => String(numberWords.indexOf(word.toLowerCase())))
  .match(/\d+(?:\.\d+)?/g) || []);
function supportedMethods(generated, source) {
  const actual = resumeText(source), written = resumeText(generated);
  const explicitMethods = ['middleware', 'JWT', 'OAuth', 'RBAC', 'caching', 'indexing'];
  return [...extractSkills(written), ...explicitMethods.filter((term) => hasSkill(written, term))]
    .every((term) => hasSkill(actual, term) ||
      (term === 'Data Pipelines' && /data\s+(?:import|processing)\s+(?:tools?|utilities|workflows?)/i.test(actual)));
}
function preservesResumeDetail(result, original = {}) {
  const actualSkills = new Set(Object.values(original.skills || {}).flat().filter((value) => typeof value === 'string').map(normalizeSkill));
  const skillValues = Object.values(result.skills || {}).flat();
  if (skillValues.some((skill) => typeof skill !== 'string' || !actualSkills.has(normalizeSkill(skill)))) return false;
  if ([...actualSkills].some((skill) => !(result.skills?.all || []).some((value) => normalizeSkill(value) === skill))) return false;
  for (const [section, identity] of [['workExperience', ['role', 'company', 'startDate', 'endDate', 'location']], ['projects', ['title', 'link']]]) {
    const source = original[section] || [], remaining = [...(result[section] || [])];
    if (source.length !== remaining.length) return false;
    for (const entry of source) {
      const index = remaining.findIndex((candidate) => identity.every((key) => same(candidate[key], entry[key])));
      if (index < 0) return false;
      const candidate = remaining.splice(index, 1)[0];
      if (!supportedMethods(candidate, original)) return false;
      if (!Array.isArray(candidate.highlights) || candidate.highlights.some((line) => typeof line !== 'string' || !line.trim()) ||
        candidate.highlights.length < (entry.highlights || []).length) return false;
      if (section === 'workExperience' && Boolean(candidate.current) !== Boolean(entry.current)) return false;
      const originalNumbers = numbers(resumeText({ highlights: entry.highlights, description: entry.description }));
      const retainedNumbers = numbers(resumeText({ highlights: candidate.highlights, description: candidate.description }));
      if ([...originalNumbers].some((value) => !retainedNumbers.has(value))) return false;
      if (section === 'projects') {
        if (entry.description?.trim() && (typeof candidate.description !== 'string' || !candidate.description.trim())) return false;
        const technologies = new Set((entry.technologies || []).map(normalizeSkill));
        if (!Array.isArray(candidate.technologies) || new Set(candidate.technologies.map(normalizeSkill)).size !== technologies.size ||
          candidate.technologies.some((value) => !technologies.has(normalizeSkill(value)))) return false;
      }
    }
  }
  const sourceNumbers = numbers(resumeText(original));
  const generatedNumbers = numbers(resumeText({ summary: result.summary, workExperience: result.workExperience, projects: result.projects }));
  return [...generatedNumbers].every((value) => sourceNumbers.has(value)) && supportedMethods({ summary: result.summary }, original);
}

function improvementSuggestions(data = {}) {
  const suggestions = [];
  for (const entry of data.workExperience || []) {
    const bullets = entry.highlights || [];
    if (bullets.length < 3 || bullets.some((text) => text.trim().split(/\s+/).length < 10)) {
      suggestions.push('For ' + [entry.role, entry.company].filter(Boolean).join(' at ') + ', add specific responsibilities, tools used, scope and a result you can verify.');
    }
  }
  for (const project of data.projects || []) {
    if (!project.description || project.description.trim().split(/\s+/).length < 20 || !(project.highlights || []).length) {
      suggestions.push('For ' + project.title + ', describe the problem, your own contribution, implementation decisions and the actual outcome.');
    }
  }
  if (!(data.workExperience || []).length && !(data.projects || []).length) {
    suggestions.push('Add relevant projects, internships, coursework or volunteering with your actual contributions and results.');
  }
  return suggestions;
}
function groqResumeInput(data) {
  const fields = ['contactInfo', 'summary', 'skills', 'workExperience', 'education', 'projects', 'certifications'];
  const input = typeof data === 'string' ? data : JSON.stringify(Object.fromEntries(fields
    .filter((key) => data[key] !== undefined).map((key) => [key, data[key]])),
    (key, value) => ['_id', '__v'].includes(key) ? undefined : value);
  if (input.length > 48000) throw new Error('Resume exceeds the full-context Groq input limit; source details were not silently truncated');
  return input;
}
module.exports = { parsingInstructions, tailoringInstructions, preservesResumeDetail, improvementSuggestions, groqResumeInput };
