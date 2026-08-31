const test = require('node:test');
const assert = require('node:assert/strict');

const authService = require('../src/services/authService');

test('normalizeFirebaseProfile should normalize Firebase user data for authentication', () => {
  const profile = authService.normalizeFirebaseProfile({
    email: 'GoogleUser@Example.com',
    name: 'Google User',
    picture: 'https://example.com/avatar.png',
    uid: 'firebase-uid-123',
  });

  assert.deepEqual(profile, {
    uid: 'firebase-uid-123',
    email: 'googleuser@example.com',
    name: 'Google User',
    picture: 'https://example.com/avatar.png',
  });
});
