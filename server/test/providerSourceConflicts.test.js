const test = require('node:test');
const assert = require('node:assert/strict');
const ChatCompletionProvider = require('../src/providers/chatCompletionProvider');
const { validateResult } = require('../src/providers/validateResult');
const { assessMatch } = require('../src/services/requirementMatching');

test('live parsing withholds conflicting skills even when the provider omits the source denial', async () => {
  const provider = new ChatCompletionProvider({ name: 'groq' });
  provider._callChatCompletion = async () => ({
    contactInfo: { name: 'Eva Wynn', email: 'eva@candidate.example' }, summary: 'Built HTML forms.',
    skills: { all: ['React', 'HTML'], frameworks: ['React'] },
    workExperience: [], education: [], certifications: [], projects: [{ title: 'Forms', technologies: ['React', 'HTML'] }],
  });
  const raw = 'Eva Wynn\neva@candidate.example\nSkills\nReact, HTML\nSummary\nI do not know React.\nBuilt HTML forms.';
  const result = validateResult('parseResume', await provider.parseResume(raw), raw);
  assert.deepEqual(result.skills.all, ['HTML']);
  assert.deepEqual(result.projects[0].technologies, ['HTML']);
  const matches = assessMatch({ resumeData: result, jobDescriptionText: 'Required skills: React, HTML' }).requirementMatches;
  assert.equal(matches.find(item => item.label === 'React').status, 'uncertain');
  assert(matches.find(item => item.label === 'React').conflictingEvidence.some(item => item.quote === 'I do not know React.'));
  assert.equal(matches.find(item => item.label === 'HTML').status, 'supported');
});
