import type { Result, SuccessfulResult } from '../utilities/result.js';

export function requireSuccessfulResult<Type>(
  result: Result<Type>,
): asserts result is SuccessfulResult<Type> {
  expect(result.didSucceed).toBe(true);
}
