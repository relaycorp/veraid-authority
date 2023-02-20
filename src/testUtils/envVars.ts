import { jest } from '@jest/globals';
import envVar from 'env-var';

interface EnvironmentVariableSet {
  readonly [key: string]: string | undefined;
}

export function configureMockEnvVars(
  environmentVariables: EnvironmentVariableSet = {},
): (environmentVariables: EnvironmentVariableSet) => void {
  const mockEnvironmentVariableGet = jest.spyOn(envVar, 'get');

  function setEnvironmentVariables(newEnvironmentVariables: EnvironmentVariableSet): void {
    mockEnvironmentVariableGet.mockReset();
    mockEnvironmentVariableGet.mockImplementation((...args: readonly any[]) => {
      const originalEnvironmentVariable = jest.requireActual('env-var') as any;
      const environment = originalEnvironmentVariable.from(newEnvironmentVariables);

      return environment.get(...args);
    });
  }

  beforeAll(() => {
    setEnvironmentVariables(environmentVariables);
  });
  beforeEach(() => {
    setEnvironmentVariables(environmentVariables);
  });

  afterAll(() => {
    mockEnvironmentVariableGet.mockRestore();
  });

  return (newEnvironmentVariables: EnvironmentVariableSet) => {
    setEnvironmentVariables(newEnvironmentVariables);
  };
}
