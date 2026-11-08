const test = require('node:test');
const assert = require('node:assert/strict');
const DeterministicProvider = require('../src/providers/deterministicProvider');
const { analyzeSkillClaims } = require('../src/providers/resumeClaims');
const { splitResumeSections } = require('../src/providers/resumeLayout');
const { activeSkillConflicts } = require('../src/providers/skillConflicts');

const sorted = items => [...items].sort();

test('an ownership table keeps blank cells and repeated skill text in their own columns', async () => {
  const source = [
    'Tools a separate support team used\tTools I used',
    'Python\tPython',
    'MongoDB\t',
    '\tDocker',
    '',
    'Redis\t',
    '',
    'I deployed Linux workstations.',
  ].join('\r\n');
  const { statements } = splitResumeSections(source);
  const python = statements.filter(item => item.text === 'Python');
  assert.deepEqual(python.map(item => item.context), ['external', 'skills']);
  assert(python[0].start < python[1].start);
  assert(statements.every(item => source.slice(item.start, item.end) === item.text));
  for (const skill of ['MongoDB', 'Redis']) assert.equal(statements.find(item => item.text === skill).context, 'external');
  const parsed = await new DeterministicProvider().parseResume(source);
  assert.deepEqual(sorted(parsed.skills.all), ['Docker', 'Linux', 'Python']);
});

test('keyed and dotted work fields establish only the skills in their own rows', async () => {
  const source = [
    '[work_sample]',
    'language_I_used=Rust',
    'What I built ..... Algorithms and data structures for dispatch',
    'Course catalog entry I did not take ..... Java Programming',
    '[training_I_plan_to_take]',
    'Tools: AWS and Terraform',
  ].join('\n');
  const parsed = await new DeterministicProvider().parseResume(source);
  assert.deepEqual(sorted(parsed.skills.all), ['Algorithms', 'Data Structures', 'Rust']);
});

test('interview speaker markers preserve candidate work and leave copied transcripts external', async () => {
  const transcript = 'INTERVIEWER: My team uses Agile. What was your contribution?\nAPPLICANT: I planned and conducted user research. I made a prototype in Figma.';
  const provider = new DeterministicProvider();
  assert.deepEqual(sorted((await provider.parseResume(transcript)).skills.all), ['Figma', 'User Research']);
  const copied = await provider.parseResume('Reference context\n' + transcript + '\nMy skills: Git');
  assert.deepEqual(copied.skills.all, ['Git']);
});

test('explicit work verbs, owned artifacts and technology nouns do not borrow another owner’s skills', () => {
  const source = [
    'Rewrote the service in PHP and Laravel.',
    'I owned system design for the service, including its PostgreSQL writes and Redis leases.',
    'My Scikit-Learn classifier flagged errors.',
    'The operations group used Scrum.',
    'In another office my colleague wrote a FastAPI service.',
    'My work did not involve that service or its MongoDB store.',
    'I used Python to audit a feed maintained by another contractor who wrote it in Java.',
    'I received a vendor proposal listing Kafka.',
    'A possible migration plan from a vendor lists Docker, which I have never used.',
  ].join('\n');
  const result = analyzeSkillClaims(source);
  assert.deepEqual(sorted(result.positiveSkills), ['Laravel', 'PHP', 'PostgreSQL', 'Python', 'Redis', 'Scikit-Learn', 'System Design']);
  assert(result.candidateText.every(quote => source.includes(quote)));
  assert.deepEqual(analyzeSkillClaims('Ruby uses React.', { context: 'skills' }).positiveSkills, []);
  assert.deepEqual(analyzeSkillClaims('I received a vendor proposal listing Kafka.', { context: 'skills' }).positiveSkills, []);
  assert.deepEqual(analyzeSkillClaims('I built a Java service and reviewed a vendor plan for Kafka.').positiveSkills, ['Java']);
});

test('coordinated writing denials withhold a contradictory claim and preserve verbatim evidence', async () => {
  const positive = 'I wrote JavaScript for the exhibition filter.';
  const denial = 'I have never written or used JavaScript for any project.';
  const source = positive + '\n' + denial + '\nI coded the pages in HTML and CSS.';
  const parsed = await new DeterministicProvider().parseResume(source);
  assert.deepEqual(sorted(parsed.skills.all), ['CSS', 'HTML']);
  const [conflict] = activeSkillConflicts(parsed);
  assert.equal(conflict.skill, 'JavaScript');
  assert(conflict.positiveEvidence.some(item => item.quote === positive));
  assert(conflict.negativeEvidence.some(item => item.quote === denial));
  assert.deepEqual(analyzeSkillClaims('I never used the logger or wrote Python for the project.').deniedSkills, ['Python']);
});
