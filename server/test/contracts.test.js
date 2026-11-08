const { test } = require('node:test'), assert = require('node:assert/strict');
const spec = require('../src/openapi');
const routes = { evidence: 'evidence', health: 'health', auth: 'auth', profile: 'profile', privacy: 'privacy', workspaces: 'workspace', 'workspaces/{id}/pack': 'applicationPack', resumes: 'resume', interview: 'interview', jobs: 'job', applications: 'application', 'processing-jobs': 'processing', notifications: 'notification' };
test('Phase 1: OpenAPI validates and documents every mounted API operation', async () => {
  await require('@apidevtools/swagger-parser').validate(structuredClone(spec));
  const actual = [];
  for (const [prefix, name] of Object.entries(routes)) {
    const router = require('../src/routes/' + name + 'Routes');
    for (const layer of router.stack) if (layer.route) {
      const path = ('/' + prefix + (layer.route.path === '/' ? '' : layer.route.path)).replace(/:([a-zA-Z0-9_]+)/g, '{$1}');
      for (const method of Object.keys(layer.route.methods)) actual.push(method.toUpperCase() + ' ' + path);
    }
  }
  const documented = Object.entries(spec.paths).flatMap(([path, methods]) => Object.keys(methods).map((method) => method.toUpperCase() + ' ' + path));
  assert.deepEqual(actual.sort(), documented.sort());
  assert.equal(spec.paths['/privacy/deletion-status'].post.security.length, 0);
  assert.equal(spec.paths['/privacy/export'].post.responses[200].content['application/zip'].schema.format, 'binary');
});
test('OpenAPI describes private application reminders and the calendar download', () => {
  const reminders = spec.paths['/applications/reminders'].get;
  const calendar = spec.paths['/applications/calendar.ics'].get;
  assert.deepEqual(reminders.security, [{ bearerAuth: [] }]);
  assert.deepEqual(calendar.security, [{ bearerAuth: [] }]);
  const events = reminders.responses[200].content['application/json'].schema.properties.data;
  assert.equal(events.type, 'array');
  assert.deepEqual(events.items.properties.kind.enum, ['deadline', 'interviewAt', 'followUpAt']);
  assert.equal(events.items.properties.at.format, 'date-time');
  assert.equal(events.items.properties.overdue.type, 'boolean');
  assert.equal(calendar.parameters[0].name, 'id');
  assert.equal(calendar.parameters[0].in, 'query');
  assert.notEqual(calendar.parameters[0].required, true);
  assert.equal(calendar.responses[200].content['text/calendar'].schema.format, 'binary');
  assert.match(calendar.responses[200].headers['Content-Disposition'].example, /attachment.*\.ics/);
});
test('Phase 1: Compose separates producer and worker with persistent private storage', () => {
  const fs = require('node:fs'), path = require('node:path');
  const config = require('yaml').parse(fs.readFileSync(path.resolve(__dirname, '../../compose.yaml'), 'utf8'));
  assert.deepEqual(Object.keys(config.services).sort(), ['api', 'frontend', 'mailpit', 'mongo', 'redis', 'worker']);
  assert.equal(config.services.api.environment.QUEUE_MODE, 'producer'); assert.equal(config.services.worker.environment.QUEUE_MODE, 'worker');
  for (const service of Object.values(config.services)) assert(service.healthcheck);
  assert.deepEqual(config.services.api.volumes, config.services.worker.volumes);
  assert(config.volumes['mongo-data'] !== undefined); assert(config.volumes['redis-data'] !== undefined);
  assert.equal(config.services.mongo.ports, undefined); assert.equal(config.services.redis.ports, undefined);
});
