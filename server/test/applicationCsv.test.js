const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parse, cell, duplicate } = require('../src/services/applicationCsv');
test('CSV parser preserves quoted commas, escaped quotes and multiline notes', () => {
  const rows = parse('\uFEFFcompany,roleTitle,notes\r\n"Example, Inc",Engineer,"First line\nSecond ""quoted"" line"\r\n');
  assert.equal(rows.length, 1); assert.equal(rows[0].values.company, 'Example, Inc');
  assert.equal(rows[0].values.notes, 'First line\nSecond "quoted" line');
  assert.equal(rows[0].row, 2);
  assert.throws(() => parse('company,roleTitle\n"Unclosed,Engineer'), /unclosed/);
  assert.throws(() => parse('company,roleTitle,bad\nCo,Engineer,x'), /unsupported/);
  assert.equal(parse('company,roleTitle\nCo,Engineer,extra')[0].error, 'Column count does not match headings.');
});
test('CSV export neutralizes formulas and duplicate keys ignore tracking URL metadata', () => {
  assert.equal(cell('=HYPERLINK("bad")'), '"\'=HYPERLINK(""bad"")"');
  assert.equal(cell('  +123'), '"\'  +123"');
  assert(duplicate({ company: 'Same Co', roleTitle: 'Engineer' }, { company: ' same co ', roleTitle: 'Engineer' }));
  assert(duplicate({ jobLink: 'https://example.test/job/1?utm_source=test' }, { jobLink: 'https://example.test/job/1' }));
});
