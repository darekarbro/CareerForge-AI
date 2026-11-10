module.exports = ({ test, assert, request, user, ready }) => {
  test('Phase 5: saved opportunity priorities persist, are explained, and are isolated by account', async () => {
    const a = await user(), b = await user(), resume = await ready(a.id);
    const first = await request('POST', '/api/workspaces', { token: a.token, body: { company: 'Alpha', title: 'Python Engineer', description: 'Python required. Remote in Pune.', resumeId: resume._id.toString() } });
    assert.equal(first.status, 201);
    assert.equal((await request('POST', '/api/workspaces', { token: a.token, body: { company: 'Beta', title: 'Designer', description: 'Figma required. Onsite in Delhi.' } })).status, 201);
    assert.equal((await request('PUT', '/api/workspaces/preferences', { token: a.token, body: { revision: 0, roles: ['Engineer'], locations: ['Pune'], workModes: ['remote'], avoidCompanies: [] } })).status, 200);
    let result = (await request('GET', '/api/workspaces/ranked', { token: a.token })).data.data;
    assert.equal(result.items.length, 2); assert.equal(result.items[0].workspace.company, 'Alpha');
    assert(result.items[0].reasons.some((reason) => reason.label.includes('Preferred role: Engineer')));
    assert(result.items[0].evidence.some((row) => row.skill === 'Python'));
    assert.equal((await request('GET', '/api/workspaces/ranked', { token: b.token })).data.data.items.length, 0);
    assert.equal((await request('GET', '/api/workspaces/preferences', { token: b.token })).data.data.revision, 0);
    assert.equal((await request('PUT', '/api/workspaces/preferences', { token: a.token, body: { ...result.preferences, revision: 0 } })).status, 400);
    const preferences = { revision: result.preferences.revision, roles: ['Designer'], locations: [], workModes: [], avoidCompanies: ['Alpha'] };
    assert.equal((await request('PUT', '/api/workspaces/preferences', { token: a.token, body: preferences })).status, 200);
    assert.equal((await request('PUT', '/api/workspaces/preferences', { token: a.token, body: preferences })).status, 409);
    result = (await request('GET', '/api/workspaces/ranked', { token: a.token })).data.data;
    assert.equal(result.items[0].workspace.company, 'Beta');
    assert.equal(result.items[1].deprioritized, true);
  });
};
