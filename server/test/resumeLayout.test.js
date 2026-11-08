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

test('compact capability categories accept slash, bracket and labeled payloads with exact source spans', () => {
  const rows = ['TOOLBOX // Python · FastAPI · PostgreSQL · Docker', 'DELIVERY // Linux · CI/CD',
    'Web [TypeScript; ReactJS; Redux]', 'Server [Nodejs; Express]', 'Storage [Postgres]', 'Checks [Jest]',
    'Cloud toolkit: AWS, Docker, Kubernetes, Terraform.', 'Application stack: C# and .NET',
    'Cloud: Azure', 'Database language: SQL', 'Testing: Cypress and Jest', 'Workflow: Git',
    'Focus: Golang, Microservices, System Design, Kafka.', 'Skills list: MySQL, Git.', 'Tooling — Nodejs | Express | MongoDB | Redis.'];
  const source = ['Candidate Name', ...rows].join('\n'), { parts, statements } = splitResumeSections(source);
  assert.equal(parts.skills.length, rows.length);
  assert(statements.filter(item => item.section === 'skills').every(item => item.context === 'skills'));
  for (const item of statements) {
    assert(source.includes(item.text)); assert.equal(source.slice(item.start, item.end), item.text);
  }
  for (const prefix of ['Employer', 'Customer', 'Unknown label']) {
    const row = prefix + ' [React; AWS]';
    assert.equal(splitResumeSections(row).statements[0].context, 'unknown', row);
    assert.equal(headingSection(prefix), null, prefix);
  }
  assert.equal(splitResumeSections('Requested approach [React; AWS]').statements[0].context, 'external');
  assert.equal(headingSection('Requested approach'), 'external');
});

test('wrapped work-kit and strengths lists keep capability context and original line breaks', () => {
  for (const newline of ['\n', '\r\n']) {
    const source = ['Work kit: C++, Rust,', '  Linux, and Docker.', 'Strengths: Algorithms and', '  Data Structures.',
      'Candidate clarification', 'I have no Rust skills.'].join(newline);
    const { statements, parts } = splitResumeSections(source), paragraphs = claimParagraphs(source, statements);
    assert.deepEqual(parts.skills, ['C++, Rust,', 'Linux, and Docker.', 'Algorithms and', 'Data Structures.']);
    assert.equal(parts.summary[0], 'I have no Rust skills.');
    assert(paragraphs.some(item => item.text === 'Algorithms and' + newline + '  Data Structures.' && item.context === 'skills'));
    assert(paragraphs.every(item => source.includes(item.text)));
  }
});

test('category/value capability tables read only the capability column and stop at a real section boundary', () => {
  for (const delimiter of [' | ', '\t', '       ']) {
    const source = ['AREA' + delimiter + 'PRACTICE', 'Application' + delimiter + 'C#, .NET', 'Cloud' + delimiter + 'Azure',
      'Data' + delimiter + 'SQL', 'Delivery' + delimiter + 'Git, CI/CD', 'Experience: Example Works', 'Built Python validators.'].join('\n');
    const { parts, statements } = splitResumeSections(source);
    assert.deepEqual(parts.skills, ['C#, .NET', 'Azure', 'SQL', 'Git, CI/CD']);
    assert.deepEqual(parts.experience, ['Example Works', 'Built Python validators.']);
    assert(!statements.some(item => ['AREA', 'PRACTICE', 'Application', 'Cloud', 'Data', 'Delivery'].includes(item.text)));
    assert(statements.every(item => source.includes(item.text)));
  }
  const unrelated = splitResumeSections('CUSTOMER | EMPLOYER\nAWS Services | React Factory');
  assert.equal(unrelated.parts.skills, undefined);
  assert(unrelated.statements.every(item => item.context === 'unknown'));
});

test('correction and reference headings end positive list context without stripping denial content', () => {
  for (const heading of ['Candidate clarification', 'Skills correction', 'Project correction', 'Correction to this resume',
    'Clarification from the candidate', 'Amendment', 'Addendum', 'Background note']) {
    const source = 'Delivery skills\nGit, CI/CD\n' + heading + '\nI have never used CI/CD tooling.';
    const { parts, statements } = splitResumeSections(source);
    assert.deepEqual(parts.skills, ['Git, CI/CD']); assert.deepEqual(parts.summary, ['I have never used CI/CD tooling.']);
    assert.equal(statements[statements.length - 1].context, 'narrative');
  }
  const quoted = splitResumeSections('My skills: Python\nReference context — quoted from the hiring manager\n“Our lead uses Rust and Kubernetes.”');
  assert(quoted.parts.external.includes('“Our lead uses Rust and Kubernetes.”'));
  assert.equal(quoted.statements.at(-1).context, 'external');
});

test('external ownership survives nested capability headings, brackets, tables and blank lines', () => {
  for (const introduction of ['Reference context — quoted from the hiring manager', 'Job description:', 'Copied requirements', 'Assignment brief']) {
    const source = [introduction, 'Cloud toolkit: AWS', '', 'Web [React; TypeScript]', 'AREA | PRACTICE',
      'Delivery | CI/CD', 'Skills', 'Python', 'Experience', 'Three years of Docker experience required.'].join('\n');
    const { parts, statements } = splitResumeSections(source);
    assert.equal(parts.skills, undefined, introduction);
    assert.equal(parts.experience, undefined, introduction);
    assert(statements.length > 0); assert(statements.every(item => item.section === 'external' && item.context === 'external'));
    assert(statements.every(item => source.slice(item.start, item.end) === item.text));
  }
});

test('explicit candidate headings and dated career entries resume personal ownership after copied material', () => {
  for (const recovery of ['My skills: Python', 'Candidate skills: Python', 'Personal toolkit: Python']) {
    const { parts, statements } = splitResumeSections('Job description:\nCloud toolkit: AWS\n' + recovery);
    assert.deepEqual(parts.skills, ['Python']); assert.equal(statements.at(-1).context, 'skills');
    assert(parts.external.includes('Cloud toolkit: AWS'));
  }
  for (const heading of ['Candidate clarification', 'Candidate declaration', 'Personal statement']) {
    const result = splitResumeSections('Copied requirements\nSkills: React\n' + heading + '\nI do not know React.');
    assert.equal(result.statements.at(-1).context, 'narrative'); assert.equal(result.parts.summary[0], 'I do not know React.');
  }
  const dated = splitResumeSections('Reference context — quoted from the employer\nCloud: Azure\n\nExperience\nEngineer at Example Works, 2021–2025\nI built Python tools.');
  assert.deepEqual(dated.parts.experience, ['Engineer at Example Works, 2021–2025', 'I built Python tools.']);
  assert.equal(dated.statements.at(-1).context, 'narrative');
  const isolatedContactReference = splitResumeSections('Candidate: Ada Vale\nReference only: Dr. Bea Day\nSelected capabilities\nPython');
  assert.deepEqual(isolatedContactReference.parts.skills, ['Python']);
});
