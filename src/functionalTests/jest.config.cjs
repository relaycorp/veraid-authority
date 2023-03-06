'use strict';

const mainJestConfig = require('../../jest.config.cjs');

module.exports = {
  ...mainJestConfig,
  roots: [__dirname],
};
