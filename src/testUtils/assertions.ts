export function assertNotNull<ResultType>(result: ResultType | null): asserts result is ResultType {
  expect(result).not.toBeNull();
}
export function assertNull<ResultType>(result: ResultType | null): asserts result is null {
  expect(result).toBeNull();
}
