import type { FailureResult, Result, SuccessfulResult } from '../utilities/result.js';

export function requireSuccessfulResult<Type>(
  result: Result<Type, unknown>,
): asserts result is SuccessfulResult<Type> {
  expect(result).toHaveProperty('didSucceed', true);
}

export function requireFailureResult<FailureReason>(
  result: Result<undefined, FailureReason>,
): asserts result is FailureResult<FailureReason> {
  expect(result).toHaveProperty('didSucceed', false);
}
