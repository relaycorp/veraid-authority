import type { FailureResult, Result, SuccessfulResult } from '../utilities/result.js';

export function requireSuccessfulResult<Type>(
  result: Result<Type, unknown>,
): asserts result is SuccessfulResult<Type> {
  expect(result.didSucceed).toBe(true);
}

export function requireFailureResult<FailureReason>(
  result: Result<unknown, FailureReason>,
): asserts result is FailureResult<FailureReason> {
  expect(result.didSucceed).toBe(false);
}
