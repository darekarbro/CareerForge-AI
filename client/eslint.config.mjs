import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react-x';
import hooks from 'eslint-plugin-react-hooks';

export default [
  { ignores: ['.next/**', 'node_modules/**', 'coverage/**'] },
  js.configs.recommended,
  {
    files: ['src/**/*.js', 'test/**/*.cjs'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } }, globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-x': react, 'react-hooks': hooks },
    rules: {
      'no-unused-vars': 'off',
      'react-x/no-missing-key': 'error',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
];
