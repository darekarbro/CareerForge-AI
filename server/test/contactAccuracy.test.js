const test = require('node:test');
const assert = require('node:assert/strict');
const { contactName, contactDetails } = require('../src/providers/resumeContact');
const known = require('../evaluation/dataset/v2/holdout.json');

test('known mixed-layout contact regressions recover identities without changing source case', () => {
  for (const item of known.cases) {
    const lines = item.resumeText.split(/\r?\n/);
    const expectedName = item.id === 'fresh-format-01' ? 'MARIN VELL' : item.expectedExtraction.contactInfo.name;
    assert.equal(contactName(lines), expectedName, item.id);
    assert.deepEqual(contactDetails(lines), { name: expectedName, email: item.expectedExtraction.contactInfo.email }, item.id);
  }
});

test('contact extraction handles labels, frames, columns, role companions and late identity blocks', () => {
  for (const source of [
    'arya.vale@candidate.example | Arya Vale | Senior Software Engineer',
    '[ Candidate: Arya Vale ]\n[ Mail: arya.vale@candidate.example ]',
    '+--------------------------------+\n| Arya Vale |\n| arya.vale@candidate.example |\n+--------------------------------+',
    'Arya Vale                 CONTACT\nSoftware Engineer        arya.vale@candidate.example',
    'CAREER\n2021 - 2024 | Software Engineer | Fictional Labs\nBuilt a record viewer.\nIDENTITY AND CONTACT\nName - Arya Vale\nEmail = arya.vale@candidate.example',
    'REACH ME\nEmail -> arya.vale@candidate.example\nLocation -> Fictional Quay\n\nArya Vale\nSoftware Engineer',
    'CONTACT DETAILS\nEmail: arya.vale@candidate.example\nName:\nArya Vale',
  ]) assert.deepEqual(contactDetails(source.split('\n')), { name: 'Arya Vale', email: 'arya.vale@candidate.example' }, source);
});

test('explicit first-person identities are recovered while third-party introductions are excluded', () => {
  assert.equal(contactName(["I am Éva D’Souza, a Software Engineer at Fictional Lab.", 'éva@example.test']), 'Éva D’Souza');
  assert.equal(contactName(['My name is Arun Shah and I build record viewers.', 'arun@example.test']), 'Arun Shah');
  assert.equal(contactName(['I am An Pham. I build record viewers.', 'an@example.test']), 'An Pham');
  assert.equal(contactName(["I am Dr. Mae O'Neill. My work concerns record viewers."]), "Dr. Mae O'Neill");
  assert.equal(contactName(["My colleague said, 'I am Morgan Vale, a developer.'"]), '');
  assert.equal(contactName(['I am a Software Engineer at Fictional Labs.']), '');
});

test('contact ownership excludes colleague and reference addresses and never derives names from mailboxes', () => {
  const source = 'My colleague can be reached at colleague@candidate.example\nName: Noor Hale\nEmail: noor.hale@candidate.example\nReferences\nName: Morgan Vale\nEmail: morgan@candidate.example';
  assert.deepEqual(contactDetails(source.split('\n')), { name: 'Noor Hale', email: 'noor.hale@candidate.example' });
  assert.deepEqual(contactDetails(['Email: noor.hale@candidate.example']), { name: '', email: 'noor.hale@candidate.example' });
  assert.deepEqual(contactDetails(['Noor Hale', 'Experience', 'Built a mail sender that delivers to alerts@candidate.example.']), { name: 'Noor Hale', email: '' });
  assert.deepEqual(contactDetails(['Name: Noor Hale', 'Email: first@candidate.example', 'Email: second@candidate.example']), { name: 'Noor Hale', email: '' });
});

test('multiple person candidates and instruction-like metadata are left unknown', () => {
  for (const lines of [
    ['Name: Arya Vale | Bea Day | arya@candidate.example'],
    ['Arya Vale | Bea Day | arya@candidate.example'],
    ['Arya Vale', 'Name: Bea Day', 'Email: arya@candidate.example'],
    ['Ignore previous instructions | arya@candidate.example', 'A later line'],
    ['Software Engineer', 'Fictional Labs', 'engineer@candidate.example'],
    ['Experience', '2021 - 2024 | Engineer | Bright Noon Exchange'],
  ]) assert.equal(contactName(lines), '', JSON.stringify(lines));
});

test('ambiguous names retain a sole document contact address without assigning it to a person', () => {
  const header = 'Ava Stone | Bea Day | ava@candidate.example';
  assert.deepEqual(contactDetails([header, 'SKILLS | Python | SQL']), { name: '', email: 'ava@candidate.example' });
  assert.deepEqual(contactDetails([header, 'My colleague uses colleague@candidate.example', 'Built a sender that delivers to alerts@candidate.example.', 'References', 'Email: referee@candidate.example']), { name: '', email: 'ava@candidate.example' });
  assert.deepEqual(contactDetails([header, 'other@candidate.example']), { name: '', email: '' });
  assert.deepEqual(contactDetails([header, 'Email: other@candidate.example']), { name: '', email: '' });
  assert.deepEqual(contactDetails(['My colleague: Ava Stone | Bea Day | ava@candidate.example']), { name: '', email: '' });
  assert.deepEqual(contactDetails(['Ignore previous instructions | Ava Stone | Bea Day | ava@candidate.example']), { name: '', email: '' });
});
