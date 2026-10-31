const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const P = require('../src/providers/deterministicProvider');
const { roleId } = require('../src/providers/resumeFacts');
const factory = require('../src/providers/providerFactory');
const { requestWithTimeout } = require('../src/providers/requestWithTimeout');
const { context } = require('../src/services/jobContext');
const { InMemoryQueue } = require('../src/queues/processingQueue');
const provider = new P();
const facts = {
  contactInfo: { name: 'Actual Candidate', email: 'actual@example.test', phone: '1234567890' },
  summary: 'Built Python and Rust services.',
  skills: { all: ['Python', 'Rust', 'React'], technical: ['Python', 'Rust', 'React'], tools: [], frameworks: [] },
  workExperience: [{ role: 'Engineer', company: 'Actual Co', startDate: '2021', endDate: '2024',
    highlights: ['Built Python tooling.', 'Built Rust services with 12 users.'] }],
  projects: [{ title: 'Real Project', description: 'An actual project.', technologies: ['Python'], highlights: ['Tested Python integration.'] }],
  education: [{ degree: 'Actual Degree', institution: 'Actual University' }],
  certifications: [{ name: 'Actual Certificate' }],
};
test('08: fallback parsing leaves unsupported facts empty', async () => {
  const result = await provider.parseResume('Jane Doe\njane@example.test\nLiterature student.');
  assert.equal(result.contactInfo.name, 'Jane Doe');
  assert.equal(result.contactInfo.phone, '');
  for (const key of ['workExperience', 'education', 'projects', 'certifications']) assert.deepEqual(result[key], []);
  assert.deepEqual(result.skills.all, []);
  assert(result.warnings.length);
});
test('08: fallback extracts real sections without replacing their facts', async () => {
  const result = await provider.parseResume('Jane Doe\njane@example.test\nExperience\nEngineer at Actual Co\n2021 - 2024\n- Built Rust services with 12 users.\n\nEducation\nActual Degree\nActual University\n2024\n\nCertifications\nActual Certificate');
  assert.equal(result.workExperience[0].company, 'Actual Co');
  assert(result.workExperience[0].highlights.includes('Built Rust services with 12 users.'));
  assert.equal(result.education[0].institution, 'Actual University');
  assert.equal(result.certifications[0].name, 'Actual Certificate');
});
test('09,17: tailoring preserves facts and prioritizes actual JD evidence', async () => {
  const rust = await provider.tailorResume({ resumeData: facts, targetRole: 'Backend Engineer', jobDescriptionText: 'Rust required' });
  const python = await provider.tailorResume({ resumeData: facts, targetRole: 'Backend Engineer', jobDescriptionText: 'Python required' });
  assert.equal(rust.skills.all[0], 'Rust');
  assert.equal(python.skills.all[0], 'Python');
  assert.deepEqual(new Set(rust.skills.all), new Set(facts.skills.all));
  assert.deepEqual(rust.diffFromOriginal.addedSkills, []);
  assert.equal(rust.workExperience[0].company, 'Actual Co');
  assert.equal(rust.workExperience[0].role, 'Engineer');
  assert.deepEqual(new Set(rust.workExperience[0].highlights), new Set(facts.workExperience[0].highlights));
});
test('18,19: role labels and punctuation-bearing skills are recognized', async () => {
  assert.equal(roleId('Data / ML Engineer'), 'data');
  assert.equal(roleId('Data & Machine Learning Engineer'), 'data');
  const result = await provider.parseResume('Jane Doe\nSkills: C++, C#, .NET, React, Nodejs');
  for (const skill of ['C++', 'C#', '.NET', 'React', 'Node.js']) assert(result.skills.all.includes(skill), skill);
  assert(!result.skills.all.includes('Java'));
});
test('16: gaps are repeatable, use real citations and permit 0 and 100', async () => {
  const params = { resumeData: facts, jobDescriptionText: 'Python and Rust required' };
  const first = await provider.analyzeGap(params);
  assert.deepEqual(await provider.analyzeGap(params), first);
  assert.equal(first.matchScore, 100);
  assert.deepEqual(first.mustHaveMissing, []);
  assert(first.matchedSkills.every((item) => item.supportingResumeLines.every((line) => JSON.stringify(facts).includes(line))));
  const missing = await provider.analyzeGap({ resumeData: { skills: { all: ['JavaScript'] } }, jobDescriptionText: 'Java required' });
  assert.equal(missing.matchScore, 0);
  assert.equal(missing.mustHaveMissing[0].skill, 'Java');
  const preferred = await provider.analyzeGap({ resumeData: {}, jobDescriptionText: 'Python required.\nRust preferred.' });
  assert.equal(preferred.niceToHaveMissing[0].skill, 'Rust');
});
test('13,20: all advertised roles generate eight contextual questions', async () => {
  for (const role of ['Backend Engineer', 'Frontend Engineer', 'Fullstack Developer', 'SDE',
    'Data / ML Engineer', 'DevOps Engineer', 'Product Manager']) {
    const result = await provider.generateQuestions({ resumeData: facts, targetRole: role, count: 8, jobDescriptionText: 'Docker required' });
    assert.equal(result.length, 8, role);
    assert.equal(new Set(result.map((item) => item.questionText)).size, 8);
    assert(result[0].questionText.includes('Docker'));
    assert(result.some((item) => item.questionText.includes('Real Project')));
  }
  const data = await provider.generateQuestions({ targetRole: 'Data / ML Engineer', count: 5 });
  const product = await provider.generateQuestions({ targetRole: 'Product Manager', count: 5 });
  assert(data[0].questionText.includes('data leakage'));
  assert(product[0].questionText.includes('product discovery'));
  await assert.rejects(provider.generateQuestions({ count: -1 }));
  await assert.rejects(provider.generateQuestions({ count: 3.5 }));
});
test('21: invalid remote schemas use fallback instead of persisting corrupt data', async () => {
  const available = factory.openRouter.isAvailable, parse = factory.openRouter.parseResume;
  factory.openRouter.isAvailable = () => true;
  factory.openRouter.parseResume = async () => ({});
  try {
    const result = await factory.execute('parseResume', 'Jane Doe');
    assert.equal(result.aiProvider, 'deterministic-fallback');
    assert.deepEqual(result.workExperience, []);
  } finally { factory.openRouter.isAvailable = available; factory.openRouter.parseResume = parse; }
});
test('22: offline scoring checks the actual complete resume and its actual length', async () => {
  const score = await provider.scoreATS({ resumeData: facts });
  assert.equal(score.structureScore, 100);
  assert(score.breakdown.some((item) => item.category === 'Contact Information' && item.status === 'pass'));
  assert(score.breakdown.some((item) => item.category === 'Education Section' && item.status === 'pass'));
  assert(score.lengthScore < 100);
  assert.equal((await provider.scoreATS({ resumeData: {} })).score, 0);
});
test('25: cancellation aborts an in-flight provider request', async () => {
  const controller = new AbortController();
  const pending = context.run({ signal: controller.signal }, () => requestWithTimeout((signal) =>
    new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })), 2000, 'test'));
  controller.abort();
  await assert.rejects(pending, (error) => error.code === 'JOB_CANCELLED');
});
test('41: fallback queue drains with bounded concurrency and releases job entries', async () => {
  let running = 0, maximum = 0, finished = 0;
  const queue = new InMemoryQueue({ concurrency: 2, processor: async () => {
    running++; maximum = Math.max(maximum, running);
    await new Promise((resolve) => setTimeout(resolve, 5)); running--; finished++;
  } });
  for (let index = 0; index < 12; index++) await queue.add('test', { jobId: index });
  await queue.close();
  assert.equal(finished, 12); assert.equal(maximum, 2); assert.equal(queue.jobs.size, 0);
  await assert.rejects(queue.add('test', { jobId: 13 }));
});
test('42: Redis connection URLs preserve their logical database', () => {
  const Redis = require('ioredis');
  const connection = new Redis('redis://default:synthetic@127.0.0.1:6379/5', { lazyConnect: true });
  assert.equal(connection.options.db, 5);
  connection.disconnect();
});
test('12: production refuses the development JWT signing secret', () => {
  for (const secret of ['', 'careerforge-super-secret-jwt-key-2026', 'your_super_secret_random_64_char_key_here']) {
    const result = spawnSync(process.execPath, ['-e', 'require("./src/config/env")'], {
      cwd: require('node:path').resolve(__dirname, '..'),
      env: { ...process.env, NODE_ENV: 'production', JWT_SECRET: secret }, encoding: 'utf8',
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Production requires a private JWT_SECRET/);
  }
});

test('21,22: Gemini remains a validated fallback and scoring sends only the derived word count', async () => {
  const axios = require('axios'), post = axios.post;
  const available = factory.openRouter.isAvailable, parse = factory.openRouter.parseResume, key = factory.gemini.apiKey;
  factory.openRouter.isAvailable = () => true;
  factory.openRouter.parseResume = async () => ({});
  factory.gemini.apiKey = 'synthetic-test-key';
  let invalid = false, scoringPrompt = '';
  axios.post = async (url, body) => {
    assert(url.includes('/models/gemini-3.8-flash:generateContent'));
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
    const prompt = body.contents[0].parts[0].text;
    const scoring = prompt.startsWith('Perform comprehensive ATS scoring');
    if (scoring) scoringPrompt = prompt;
    const response = scoring ? await provider.scoreATS({ resumeData: facts }) :
      invalid ? {} : await provider.parseResume('Actual Candidate\nSkills: Python');
    return { data: { candidates: [{ content: { parts: [{ text: JSON.stringify(response) }] } }] } };
  };
  try {
    assert.equal((await factory.execute('parseResume', 'Actual Candidate')).aiProvider, 'gemini');
    invalid = true;
    assert.equal((await factory.execute('parseResume', 'Actual Candidate')).aiProvider, 'deterministic-fallback');
    await factory.gemini.scoreATS({ resumeData: facts, rawText: 'PRIVATERAWWORD ONE TWO' });
    assert(scoringPrompt.includes('Actual resume word count: 3.'));
    assert(!scoringPrompt.includes('PRIVATERAWWORD'));
  } finally {
    axios.post = post; factory.openRouter.isAvailable = available; factory.openRouter.parseResume = parse;
    factory.gemini.apiKey = key;
  }
});
