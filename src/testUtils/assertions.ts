export function assertNull<ResultType>(result: ResultType | null): asserts result is null {
  expect(result).toBeNull();
}
