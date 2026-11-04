const { plain } = require('./resumeFacts');
const { instruction } = require('../services/jobRequirements');

function resumeEvidence(resume = {}) {
  const data = plain(resume), result = [];
  const add = (path, value) => {
    if (typeof value === 'string') value.split(/\r?\n/).forEach((quote) => {
      if (quote.trim() && !instruction.test(quote)) result.push({ path, quote });
    });
    else if (Array.isArray(value)) value.forEach((item, index) => add(path + '[' + index + ']', item));
  };
  add('summary', data.summary);
  for (const key of ['all', 'technical', 'soft', 'tools', 'frameworks']) add('skills.' + key, data.skills?.[key]);
  for (const [section, fields] of Object.entries({ workExperience: ['role', 'highlights'], projects: ['title', 'description', 'technologies', 'highlights'], education: ['degree', 'fieldOfStudy'], certifications: ['name'] })) {
    for (const [index, entry] of (data[section] || []).entries()) for (const field of fields) add(section + '[' + index + '].' + field, entry[field]);
  }
  return result;
}
const negative = (text) => /\b(?:no|never|without|lack(?:ing)?|not(?:\s+(?:yet|experienced|proficient|familiar))?|beginner|aspir(?:ing|ation)|(?:want|plan(?:ning)?|hope)\s+to\s+learn|interested\s+in\s+learning|(?:am|currently|still|started)\s+learning)\b|^learning\b/i.test(text.replace(/\bnot only\b/ig, ''));
const isSkillList = (item) => /^skills\.|\.technologies\[/.test(item.path);
const usablePositive = (item) => !instruction.test(item.quote) && !negative(item.quote) && !/\b(?:required|preferred|must[ -]have)\b/i.test(item.quote);

module.exports = { resumeEvidence, negative, isSkillList, usablePositive };
