export default {
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: true,
      tsconfig: './tsconfig.json'
    }]
  },
  transformIgnorePatterns: [],
  testEnvironment: 'node',
  testMatch: [
    '**/*.test.ts'
  ],
  collectCoverageFrom: [
    'src/cli/**/*.ts',
    '!src/cli/**/*.d.ts'
  ],
  coverageDirectory: 'coverage/cli',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFiles: ['<rootDir>/jest.setup.js'],
  setupFilesAfterEnv: ['<rootDir>/setup.ts'],
  testTimeout: 30000,
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^chalk$': '<rootDir>/__mocks__/chalk.mjs',
    '^inquirer$': '<rootDir>/__mocks__/inquirer.mjs'
  },
  globals: {
    'ts-jest': {
      useESM: true
    }
  }
};
