export function mockSpy<
  Return,
  Parameters extends any[],
  MockType extends jest.MockInstance<Return, Parameters>,
>(spy: MockType, mockImplementation?: (...args: Parameters) => Return): MockType {
  beforeEach(() => {
    spy.mockReset();
    if (mockImplementation) {
      spy.mockImplementation(mockImplementation);
    }
  });

  afterAll(() => {
    spy.mockRestore();
  });

  return spy;
}

export function getMockInstance(mockedObject: any): jest.MockInstance<any, any> {
  return mockedObject as unknown as jest.MockInstance<any, any>;
}

export function getMockContext(mockedObject: any): jest.MockContext<any, any> {
  const mockInstance = getMockInstance(mockedObject);
  return mockInstance.mock;
}

export async function getPromiseRejection<ErrorType extends Error>(
  rejectingFunction: () => Promise<unknown>,
  expectedErrorType: new () => ErrorType,
): Promise<ErrorType> {
  let error: ErrorType | undefined;
  try {
    await rejectingFunction();
  } catch (err) {
    error = err as ErrorType;
  }

  expect(error).toBeInstanceOf(expectedErrorType);
  return error!;
}
