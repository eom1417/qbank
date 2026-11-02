// Merge into the ESLint flat config for EVERY first-party JS/TS/JSX/TSX file.
// The TypeScript/JSX parser/framework configuration must be supplied by the project.
// Do not apply this to generated output or external dependencies.
export const genesisStrictRules = {
  'max-lines': ['error', { max: 400, skipBlankLines: false, skipComments: false }],
  'max-lines-per-function': ['error', {
    max: 50,
    skipBlankLines: false,
    skipComments: false,
    IIFEs: true,
  }],
  complexity: ['error', { max: 10, variant: 'classic' }],
};

// Example usage in your real eslint.config.mjs AFTER configuring parsers:
// import { genesisStrictRules } from './adapters/eslint.rules.mjs';
// export default [
//   { files: ['**/*.{js,jsx,ts,tsx}'], rules: genesisStrictRules },
// ];
// Add explicit AST import-boundary rules in the real project config.
