const test = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');
const factory = require('../src/providers/providerFactory');
const schemas = require('../src/providers/responseSchemas');
const GroqProvider = require('../src/providers/groqProvider');
const { context } = require('../src/services/jobContext');
const facts = { contactInfo: { name: 'Synthetic Candidate', email: 'synthetic@example.test' },
  summary: 'Built Python tools.', skills: { all: ['Python'] }, workExperience: [], education: [], projects: [], certifications: [] };
const params = {
  parseResume: 'Synthetic Candidate\nSkills: Python',
  scoreATS: { resumeData: facts, rawText: 'Synthetic Candidate Python' },
  tailorResume: { resumeData: facts, targetRole: 'Backend Engineer', jobDescriptionText: 'Python required' },
  analyzeGap: { resumeData: facts, targetRole: 'Backend Engineer', jobDescriptionText: 'Python required' },
  generateQuestions: { resumeData: facts, targetRole: 'Backend Engineer', jobDescriptionText: 'Python required', count: 3 },
  evaluateAnswer: { question: { questionText: 'Explain testing', category: 'technical' },
    userAnswer: 'I use Python tests.', suggestedAnswer: 'Test behavior.', targetRole: 'Backend Engineer' },
};

test('Groq retries a format-validation error once and does not retry authentication errors', async () => {
  const post = axios.post, provider = new GroqProvider();
  provider.apiKey = 'synthetic-test-key';
  let calls = 0;
  axios.post = async (_url, body) => {
    calls++;
    if (calls === 1) throw Object.assign(new Error('schema failure'), { response: { status: 400, data: { error: { code: 'json_validate_failed' } } } });
    assert(body.messages[0].content.includes('Schema repair'));
    return { data: { choices: [{ message: { content: JSON.stringify(facts) } }] } };
  };
  try {
    assert.equal((await provider.parseResume(params.parseResume)).contactInfo.name, facts.contactInfo.name);
    assert.equal(calls, 2);
    calls = 0;
    axios.post = async () => { calls++; throw Object.assign(new Error('unauthorized'), { response: { status: 401 } }); };
    await assert.rejects(provider.parseResume(params.parseResume)); assert.equal(calls, 1);
  } finally { axios.post = post; }
});

test('Groq repairs provider JSON parsing failures once while ordinary bad requests fail immediately', async () => {
  const original = axios.post, provider = new GroqProvider(); provider.apiKey = 'synthetic-test-key';
  try {
    for (const apiError of [{ code: 'json_parse_failed' }, { message: 'Parsing failed. The model generated output that could not be parsed.' }]) {
      let calls = 0;
      axios.post = async (_url, body) => { calls++; if (calls === 1) throw Object.assign(new Error('Malformed model output'), { response: { status: 400, data: { error: apiError } } }); assert(body.messages[0].content.includes(JSON.stringify(schemas.parseResume))); return { data: { choices: [{ message: { content: JSON.stringify(facts) } }] } }; };
      assert.equal((await provider.parseResume('Fictional facts')).contactInfo.name, facts.contactInfo.name); assert.equal(calls, 2);
    }
    let calls = 0;
    axios.post = async () => { calls++; throw Object.assign(new Error('Invalid model configuration'), { response: { status: 400, data: { error: { code: 'invalid_request_error', message: 'Unknown model' } } } }); };
    await assert.rejects(provider.parseResume('Fictional facts')); assert.equal(calls, 1);
    calls = 0;
    axios.post = async () => { calls++; throw Object.assign(new Error('Parsing failed'), { response: { status: 400, data: { error: { code: 'json_parse_failed' } } } }); };
    await assert.rejects(provider.parseResume('Fictional facts')); assert.equal(calls, 2);
  } finally { axios.post = original; }
});

test('Groq uses strict structured outputs and valid responses for all six AI actions', async () => {
  const originalPost = axios.post, originalKey = factory.groq.apiKey;
  const seen = [];
  factory.groq.apiKey = 'synthetic-test-key';
  axios.post = async (url, body, options) => {
    assert.equal(url, 'https://api.groq.com/openai/v1/chat/completions');
    assert.equal(options.headers.Authorization, 'Bearer synthetic-test-key');
    assert.equal(body.model, 'openai/gpt-oss-120b');
    assert.equal(body.reasoning_effort, 'medium');
    assert.equal(body.response_format.type, 'json_schema');
    assert.equal(body.response_format.json_schema.strict, true);
    assert(options.signal instanceof AbortSignal);
    const action = body.response_format.json_schema.name;
    seen.push(action);
    const output = await factory.deterministic[action](params[action]);
    return { data: { choices: [{ message: { content: JSON.stringify(action === 'generateQuestions' ? { questions: output } : output) } }] } };
  };
  try {
    assert.equal(factory.getProvidersStatus().activeProvider, 'groq');
    for (const [action, input] of Object.entries(params)) {
      const attempts = [];
      const result = await factory.execute(action, input, (name) => attempts.push(name));
      assert.equal(result.aiProvider, 'groq'); assert.deepEqual(attempts, ['groq']);
    }
    assert.deepEqual(seen, Object.keys(params));
  } finally { axios.post = originalPost; factory.groq.apiKey = originalKey; }
});

test('Groq malformed schemas and API failures continue to the next validated provider', async () => {
  const post = axios.post, key = factory.groq.apiKey;
  const available = factory.openRouter.isAvailable, parse = factory.openRouter.parseResume;
  factory.groq.apiKey = 'synthetic-test-key';
  factory.openRouter.isAvailable = () => true;
  factory.openRouter.parseResume = (raw) => factory.deterministic.parseResume(raw);
  try {
    for (const failure of ['invalid-schema', 'api-error', 'invalid-json']) {
      axios.post = async () => {
        if (failure === 'api-error') throw new Error('Synthetic 429');
        return { data: { choices: [{ message: { content: failure === 'invalid-json' ? 'broken json' : '{}' } }] } };
      };
      const attempts = [];
      const result = await factory.execute('parseResume', params.parseResume, (name) => attempts.push(name));
      assert.equal(result.aiProvider, 'openrouter');
      assert.deepEqual(attempts, ['groq', 'openrouter']);
    }
  } finally {
    axios.post = post; factory.groq.apiKey = key;
    factory.openRouter.isAvailable = available; factory.openRouter.parseResume = parse;
  }
});

test('Groq placeholder keys stay disabled and the lower latency model accepts strict schemas', () => {
  const provider = new GroqProvider();
  for (const key of ['', 'your_groq_api_key_here', 'replace_me', 'placeholder']) {
    provider.apiKey = key; assert.equal(provider.isAvailable(), false);
  }
  const env = require('../src/config/env'), model = env.GROQ_MODEL;
  try {
    env.GROQ_MODEL = 'openai/gpt-oss-20b';
    assert.equal(new GroqProvider().strictSchema, true);
    env.GROQ_MODEL = 'custom-json-model';
    assert.equal(new GroqProvider().strictSchema, false);
  } finally { env.GROQ_MODEL = model; }
});

test('Every strict Groq schema requires all fields and forbids extra properties', () => {
  const visit = (schema) => {
    if (schema.type === 'object') {
      assert.equal(schema.additionalProperties, false);
      assert.deepEqual(schema.required, Object.keys(schema.properties));
      Object.values(schema.properties).forEach(visit);
    }
    if (schema.items) visit(schema.items);
  };
  Object.values(schemas).forEach(visit);
  const Tailored = require('../src/models/TailoredResume');
  const document = new Tailored({ owner: '123456789012345678901234', resumeId: '123456789012345678901234',
    targetRole: 'Engineer', aiProvider: 'groq' });
  assert.equal(document.validateSync(), undefined);
});

test('Cancelling a Groq request aborts it without attempting another provider', async () => {
  const post = axios.post, key = factory.groq.apiKey, controller = new AbortController();
  const attempts = [];
  factory.groq.apiKey = 'synthetic-test-key';
  axios.post = (_url, _body, { signal }) => new Promise((_resolve, reject) =>
    signal.addEventListener('abort', () => reject(new Error('Synthetic aborted request')), { once: true }));
  try {
    const pending = context.run({ signal: controller.signal }, () =>
      factory.execute('parseResume', params.parseResume, (name) => attempts.push(name)));
    await new Promise((resolve) => setImmediate(resolve)); controller.abort();
    await assert.rejects(pending, (error) => error.code === 'JOB_CANCELLED');
    assert.deepEqual(attempts, ['groq']);
  } finally { axios.post = post; factory.groq.apiKey = key; }
});
