/**
 * Jest runs the TypeScript sources directly through SWC (no type-checking;
 * `npm run typecheck` does that). The backend is native ESM, so Jest runs in
 * its ESM mode (see the `test` script) and the `.js` import suffixes that
 * NodeNext requires are mapped back to the `.ts` files.
 *
 * @type {import('jest').Config}
 */
export default {
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': [
      '@swc/jest',
      {
        jsc: { parser: { syntax: 'typescript' }, target: 'es2022' },
        module: { type: 'es6' },
      },
    ],
  },
  restoreMocks: true,
};
