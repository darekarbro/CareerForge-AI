const { test } = require('node:test'), assert = require('node:assert/strict'), path = require('node:path');
const { ESLint } = require('eslint');
const lint = () => new ESLint({ cwd: path.resolve(__dirname, '..') });
const filePath = 'src/components/DependencyCompatibility.js';

test('Dependency security upgrade preserves JSX key and React hook diagnostics', async () => {
  const eslint = lint();
  const messages = async (source) => (await eslint.lintText(source, { filePath }))[0].messages;
  assert((await messages('export function List({ items }) { return items.map(item => <li>{item.title}</li>); }')).some((item) => item.ruleId === 'react-x/no-missing-key'));
  assert((await messages("import { useState } from 'react'; export function Panel({ enabled }) { if (enabled) { useState(0); } return null; }")).some((item) => item.ruleId === 'react-hooks/rules-of-hooks'));
  assert((await messages("import { useEffect } from 'react'; export function Panel({ value }) { useEffect(() => { console.log(value); }, []); return null; }")).some((item) => item.ruleId === 'react-hooks/exhaustive-deps'));
  assert.deepEqual(await messages('const Item = ({ value }) => <li>{value}</li>; export function List({ items }) { return items.map(item => <Item key={item.id} value={item.title} />); }'), []);
});

test('Patched minimatch keeps lint source selection and generated-file exclusions intact', async () => {
  const eslint = lint();
  assert.equal(await eslint.isPathIgnored('src/components/DependencyCompatibility.js'), false);
  assert.equal(await eslint.isPathIgnored('test/dependencyCompatibility.test.cjs'), false);
  assert.equal(await eslint.isPathIgnored('.next/server/generated.js'), true);
  assert.equal(await eslint.isPathIgnored('node_modules/example/index.js'), true);
});
