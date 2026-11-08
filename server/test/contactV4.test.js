const test = require('node:test');
const assert = require('node:assert/strict');
const { contactDetails, contactName } = require('../src/providers/resumeContact');

const parse = text => contactDetails(text.split('\n'));

test('published v4 resumes retain every exact candidate contact field', () => {
  const { cases } = require('../evaluation/dataset/v4/holdout.json');
  for (const fixture of cases) {
    const lines = fixture.resumeText.split(/\r?\n/);
    assert.deepEqual(contactDetails(lines), fixture.expectedExtraction.contactInfo, fixture.id);
    assert.equal(contactName(lines), fixture.expectedExtraction.contactInfo.name, fixture.id);
  }
});

test('explicit form fields preserve Unicode names and email case across layouts', () => {
  const expected = { name: 'Éva D’Souza', email: 'Eva.DSouza@example.test' };
  for (const input of [
    'FORM EXPORT / APPLICANT DETAILS\nFull name ...... Éva D’Souza\nEmail ..... Eva.DSouza@example.test',
    '# Portfolio card\n| Field | Applicant entry |\n| --- | --- |\n| Applicant name | **Éva D’Souza** |\n| Applicant email | <Eva.DSouza@example.test> |',
    'Name\tÉva D’Souza\nEmail address\tEva.DSouza@example.test',
    'Portfolio › Éva D’Souza › Eva.DSouza@example.test',
    'Éva D’Souza — Eva.DSouza@example.test',
    'Candidate work sample, submitted by Éva D’Souza (Eva.DSouza@example.test)',
  ]) assert.deepEqual(parse(input), expected, input);
});

test('keyed work samples and forwarding slips cannot compete with candidate identity', () => {
  const expected = { name: 'Ásha Vale', email: 'Asha.Vale@example.test' };
  assert.deepEqual(parse('[candidate_details]\nname=Ásha Vale\nemail=Asha.Vale@example.test\n[work_sample]\nname=Archived Task\nemail=operator@example.test'), expected);
  assert.deepEqual(parse('FORWARDING NOTE\nName: Lia Sender\nEmail: sender@example.test\nCANDIDATE CV\nApplicant: Ásha Vale\nApplicant email: Asha.Vale@example.test'), expected);
  assert.deepEqual(parse('FORWARDING NOTE\nName: Lia Sender\nEmail: sender@example.test'), { name: '', email: '' });
});

test('transcript contact evidence stays with the speaker who supplied it', () => {
  const input = 'Applicant statement from a workshop\nINTERVIEWER: I am Mina Pond.\nMy email is mina@example.test.\n'
    + 'APPLICANT: My name is Éva D’Souza. My email is Eva.DSouza@example.test.\n'
    + 'APPLICANT: Absolutely\nREVIEWER: Correction notes\nName: Bea Stone\nEmail: bea@example.test';
  assert.deepEqual(parse(input), { name: 'Éva D’Souza', email: 'Eva.DSouza@example.test' });
  assert.deepEqual(parse('INTERVIEWER: Name: Mina Pond\nEmail: mina@example.test\nAPPLICANT: I prefer remote work.'), { name: '', email: '' });
});

test('new contact layouts preserve ambiguity and never derive a name from an address', () => {
  assert.deepEqual(parse('| Name | Ada Vale |\n| Name | Bea Stone |\n| Email | ada@example.test |\n| Email | bea@example.test |'), { name: '', email: '' });
  assert.deepEqual(parse('Portfolio card\nada.vale@example.test'), { name: '', email: 'ada.vale@example.test' });
  assert.deepEqual(parse('Skills\nPostgreSQL\nSent notifications to staff@example.test.'), { name: '', email: '' });
});
