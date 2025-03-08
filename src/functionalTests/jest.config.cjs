const mainJestConfig = require('../../jest.config.cjs');

module.exports = {
  ...mainJestConfig,
  roots: [__dirname],
  testPathIgnorePatterns: [],
  testTimeout: 30_000,
  preset: null,
};
