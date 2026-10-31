const { test } = require('node:test'), assert = require('node:assert/strict');
const spec = require('../src/openapi');
const routes = { evidence: 'evidence', health: 'health', auth: 'auth', profile: 'profile', privacy: 'privacy', workspaces: 'workspace', resumes: 'resume', interview: 'interview', jobs: 'job', applications: 'application', 'processing-jobs': 'processing', notifications: 'notification' };
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
