const { defineConfig } = require('eslint/config');
const expo = require('eslint-config-expo/flat');
module.exports = defineConfig([expo, { ignores: ['dist/**', 'public/pdfjs/**', 'models.ts'] }, { files: ['scripts/*.cjs'], languageOptions: { globals: { __dirname: 'readonly' } } }]);
