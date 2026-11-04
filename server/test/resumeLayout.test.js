const test = require('node:test');
const assert = require('node:assert/strict');
const { splitResumeSections, headingSection, claimParagraphs } = require('../src/providers/resumeLayout');

test('layout recognition accepts semantic headings and decorations without rewriting source claims', () => {
  const source = '# Candidate Name\nTOOLS I USE\nPython :: SQL\nSELF-ASSESSMENT\nI do not know Python.\nWORK + SKILLS / I build SQL reports.\n## Education\nBSc Computing';
  const { parts, statements } = splitResumeSections(source);
  assert(parts.skills.includes('Python :: SQL')); assert(parts.summary.includes('I do not know Python.'));
  assert(parts.skills.includes('I build SQL reports.')); assert.equal(parts.education[0], 'BSc Computing');
  for (const item of statements) assert(source.includes(item.text));
  assert.equal(headingSection('I have no React skills.'), null);
});

test('parallel headings retain separate column contexts and end at a subsequent declaration', () => {
  const { parts, statements } = splitResumeSections('CAPABILITIES              EMPLOYMENT\nJava                      Example Studio\nSQL                       Wrote reports.\nCandidate statement: I do not know Java.');
  assert.deepEqual(parts.skills, ['Java', 'SQL']); assert.deepEqual(parts.experience, ['Example Studio', 'Wrote reports.']);
  assert.deepEqual(parts.summary, ['I do not know Java.']);
  assert.equal(statements.find(item => item.text === 'Example Studio').context, 'narrative');
});

test('unrecognized prose is retained for evidence classification and empty inline headings still delimit sections', () => {
  const source = 'I build Python validators.\nSkills |\nSQL\nExperience |\nEngineer at AWS Services\n2022 - 2025';
  const { parts, statements } = splitResumeSections(source);
  assert(statements.some(item => item.text === 'I build Python validators.' && item.context === 'unknown'));
  assert.deepEqual(parts.skills, ['SQL']); assert(parts.experience.includes('Engineer at AWS Services'));
});

test('wrapped paragraphs preserve exact whitespace and do not cross headings or table columns', () => {
  const source = 'Summary\r\n  I use Python,\r\n    and React for forms.\r\nSkills\r\nSQL\r\nCAPABILITIES       EMPLOYMENT\r\nJava               Example Works';
  const { statements } = splitResumeSections(source), paragraphs = claimParagraphs(source, statements);
  assert.equal(paragraphs[0].text, 'I use Python,\r\n    and React for forms.');
  assert(paragraphs.some(item => item.text === 'SQL'));
  assert(paragraphs.some(item => item.text === 'Java'));
  assert(paragraphs.some(item => item.text === 'Example Works'));
  for (const item of paragraphs) assert(source.includes(item.text));
});
