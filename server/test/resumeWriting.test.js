const test = require('node:test');
const assert = require('node:assert/strict');
const { validateResult } = require('../src/providers/validateResult');
const factory = require('../src/providers/providerFactory');
const source = {
  summary: 'Python and Rust developer working on data quality.',
  skills: { all: ['Python', 'Rust'], technical: ['Python', 'Rust'], tools: [], frameworks: [], soft: [] },
  workExperience: [{ role: 'Developer', company: 'Example Labs', startDate: '2023', endDate: '2025', current: false,
    location: 'Example City', highlights: ['Built Python validation tools and reduced invalid records by 25%.', 'Reviewed changes with three developers.'] }],
  projects: [{ title: 'Data Checker', description: 'A Python tool that validates incoming records.', link: 'https://example.test/checker',
    technologies: ['Python'], highlights: ['Added unit tests for validation errors.'] },
  { title: 'Rust Demo', description: 'A Rust command-line example.', link: '', technologies: ['Rust'], highlights: ['Handled invalid input.'] }],
};
const tailored = () => ({ summary: source.summary, skills: structuredClone(source.skills),
  workExperience: structuredClone(source.workExperience), projects: structuredClone(source.projects),
  diffFromOriginal: { addedSkills: [], removedSkills: [], modifiedHighlights: [], summaryDiff: { original: source.summary, tailored: source.summary } } });
const validate = (result) => validateResult('tailorResume', result, { resumeData: source });

test('Detailed tailoring keeps project coverage, technical detail and every verified skill', () => {
  assert(validate(tailored()));
  for (const change of [
    (result) => result.projects.pop(),
    (result) => result.skills.all.pop(),
    (result) => { result.projects[0].description = ''; },
    (result) => { result.projects[0].technologies = []; },
    (result) => result.workExperience[0].highlights.pop(),
    (result) => { result.workExperience[0].company = 'Invented Company'; },
    (result) => { result.workExperience[0].highlights.push('Added JWT middleware and Redis caching.'); },
  ]) {
    const result = tailored(); change(result);
    assert.throws(() => validate(result), /Invalid provider schema/);
  }
});
test('Detailed wording retains actual metrics and rejects invented quantitative achievements', () => {
  const result = tailored();
  result.workExperience[0].highlights[1] = 'Reviewed changes collaboratively with 3 developers.';
  assert(validate(result));
  result.workExperience[0].highlights[0] = 'Built Python tools and reduced invalid records by 80%.';
  assert.throws(() => validate(result), /Invalid provider schema/);
  result.workExperience[0].highlights[0] = 'Built Python tools for record validation.';
  assert.throws(() => validate(result), /Invalid provider schema/);
});
test('An abbreviated remote result falls back to a complete resume instead of losing projects', async () => {
  const available = factory.groq.isAvailable, generate = factory.groq.tailorResume;
  factory.groq.isAvailable = () => true;
  factory.groq.tailorResume = async () => { const result = tailored(); result.projects.pop(); return result; };
  try {
    const result = await factory.execute('tailorResume', { resumeData: source, targetRole: 'Backend Engineer' });
    assert.equal(result.aiProvider, 'deterministic-fallback');
    assert.equal(result.projects.length, 2);
    assert.deepEqual(result.workExperience[0].highlights, source.workExperience[0].highlights);
  } finally { factory.groq.isAvailable = available; factory.groq.tailorResume = generate; }
});

test('Categorized skills remain in the complete skill set even for older incomplete all lists', async () => {
  const original = structuredClone(source);
  original.skills.soft = ['Communication'];
  const result = await factory.deterministic.tailorResume({ resumeData: original, targetRole: 'Backend Engineer' });
  assert(result.skills.all.includes('Communication'));
  assert(validateResult('tailorResume', result, { resumeData: original }));
});

test('Supported data-import wording is accepted while new technology claims are rejected', () => {
  const original = structuredClone(source), result = tailored();
  original.workExperience[0].highlights[0] = 'Built Python data import tools and reduced invalid records by 25%.';
  result.workExperience[0].highlights[0] = 'Built Python data pipelines for importing records and reduced invalid records by 25%.';
  assert(validateResult('tailorResume', result, { resumeData: original }));
  result.workExperience[0].highlights[0] += ' Deployed Kafka streaming.';
  assert.throws(() => validateResult('tailorResume', result, { resumeData: original }), /Invalid provider schema/);
});

test('Groq receives complete long input without database IDs while other provider limits stay unchanged', async () => {
  const Groq = require('../src/providers/groqProvider'), OpenRouter = require('../src/providers/openRouterProvider');
  const Gemini = require('../src/providers/geminiProvider');
  const groq = new Groq(), router = new OpenRouter(), gemini = new Gemini();
  let supplied = '';
  const capture = async (_system, input) => { supplied = input; return {}; };
  groq._callChatCompletion = capture; router._callChatCompletion = capture;
  gemini._callGemini = async (input) => { supplied = input; return {}; };
  const raw = 'Verified source detail. '.repeat(450) + 'LATE_SOURCE_MARKER';
  await groq.parseResume(raw); assert(supplied.endsWith('LATE_SOURCE_MARKER'));
  await router.parseResume(raw); assert(!supplied.includes('LATE_SOURCE_MARKER'));
  await gemini.parseResume(raw); assert(!supplied.includes('LATE_SOURCE_MARKER'));
  const resume = { ...structuredClone(source), summary: 'Detailed source. '.repeat(450),
    _id: 'INTERNAL_DATABASE_ID', projects: [{ ...source.projects[0], _id: 'INTERNAL_PROJECT_ID', title: 'LATE_PROJECT_MARKER' }] };
  await groq.tailorResume({ resumeData: resume, targetRole: 'Developer' });
  assert(supplied.includes('LATE_PROJECT_MARKER')); assert(!supplied.includes('INTERNAL_PROJECT_ID'));
  assert(!supplied.includes('INTERNAL_DATABASE_ID'));
  await router.tailorResume({ resumeData: resume, targetRole: 'Developer' }); assert(!supplied.includes('LATE_PROJECT_MARKER'));
  await gemini.tailorResume({ resumeData: resume, targetRole: 'Developer' }); assert(!supplied.includes('LATE_PROJECT_MARKER'));
  await assert.rejects(groq.parseResume('x'.repeat(48001)), /input limit/);
});

test('Detailed multi-page PDF export retains late achievements, education and certification sections', async () => {
  const service = require('../src/services/tailoringService'), resumes = require('../src/services/resumeService');
  const getVersion = service.getTailoredVersion, getResume = resumes.getResumeById;
  const content = structuredClone(source);
  content.contactInfo = { name: 'Detailed Candidate', email: 'detail@example.test' };
  content.workExperience[0].highlights = Array.from({ length: 55 }, (_value, index) =>
    'Achievement ' + (index + 1) + ': implemented Python validation, documented error cases and reviewed actual behavior with the development team.');
  content.education = [{ degree: 'BSc', institution: 'Late University', graduationYear: '2024' }];
  content.certifications = [{ name: 'Final Certificate', issuer: 'Example Institute' }];
  service.getTailoredVersion = async () => ({ resumeId: 'fixture', tailoredContent: content });
  resumes.getResumeById = async () => ({ title: 'Detailed resume', parsedData: content });
  try {
    const doc = await service.generatePdf('fixture', 'owner'), chunks = [];
    await new Promise((resolve, reject) => { doc.on('data', (chunk) => chunks.push(chunk)); doc.on('end', resolve); doc.on('error', reject); });
    const parsed = await require('pdf-parse')(new Uint8Array(Buffer.concat(chunks)));
    assert(parsed.numpages > 1);
    for (const text of ['Achievement 55', 'Late University', 'Final Certificate', 'Data Checker', 'Rust Demo']) assert(parsed.text.includes(text), text);
  } finally { service.getTailoredVersion = getVersion; resumes.getResumeById = getResume; }
});
