import type { FromSchema } from 'json-schema-to-ts';

import { validateMessage } from './validateMessage.js';

const TEST_SCHEMA = {
  type: 'object',

  properties: {
    testField: { type: 'string' },
  },

  required: ['testField'],
} as const;

type Test = FromSchema<typeof TEST_SCHEMA>;

describe('validateMessage', () => {
  test('Valid data should return an object type', () => {
    const testData: Test = {
      testField: 'test',
    };

    const result = validateMessage(
      {
        testField: 'test',
      },
      TEST_SCHEMA,
    );

    expect(result).toStrictEqual(testData);
  });

  test('Invalid data should return an error', () => {
    const result = validateMessage(
      {
        testField: 1,
      },
      TEST_SCHEMA,
    );

    expect(result).toBe('data/testField must be string');
  });
});
