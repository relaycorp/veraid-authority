export function mockSpy<Return, Parameters extends any[], Context>(
  spy: jest.MockInstance<Return, Parameters, Context>,
  mockImplementation?: (...args: Parameters) => any,
): jest.MockInstance<Return, Parameters, Context> {
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
