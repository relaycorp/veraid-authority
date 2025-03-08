const mainJestConfig = require('../../jest.config.cjs');

module.exports = {
  ...mainJestConfig,
  roots: [__dirname],
  testPathIgnorePatterns: [],
  preset: null,
};
