import { FromSchema } from 'json-schema-to-ts';
import { validateMessage } from './validateMessage.js';

export const TEST_SCHEMA = {
  type: 'object',

  properties: {
    testField: { type: 'string' },
  },

  required: ['testField'],
} as const;

export type Test = FromSchema<typeof TEST_SCHEMA>;
describe('validateMessage', () => {
  test('Valid data should return an object type', async () => {
    const testData : Test = {
      testField: 'test'
    };

    const result = validateMessage({
      testField: "test"
    }, TEST_SCHEMA);

    expect(result).toStrictEqual(testData)
  });

  test('Invalid data should return an error', async () => {
    const result = validateMessage({
      testField: 1
    }, TEST_SCHEMA);

    expect(result).toStrictEqual("data/testField must be string")
  });
});
