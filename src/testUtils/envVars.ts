import { jest } from '@jest/globals';
import envVar from 'env-var';

import { K_SINK } from './eventing/stubs.js';
import { MONGODB_URI } from './db.js';

interface EnvVarSet {
  readonly [key: string]: string | undefined;
}

export const REQUIRED_ENV_VARS = {
  AUTHORITY_VERSION: '1.2.3',
  K_SINK,
  MONGODB_URI,
};

export function configureMockEnvVars(envVars: EnvVarSet = {}): (envVars: EnvVarSet) => void {
  const mockEnvVarGet = jest.spyOn(envVar, 'get');
  function setEnvironmentVariables(newEnvVars: EnvVarSet): void {
    mockEnvVarGet.mockReset();
    mockEnvVarGet.mockImplementation((envVarName) => {
      const environment = envVar.from(newEnvVars);
      return environment.get(envVarName);
    });
  }

  beforeAll(() => {
    setEnvironmentVariables(envVars);
  });
  beforeEach(() => {
    setEnvironmentVariables(envVars);
  });

  afterAll(() => {
    mockEnvVarGet.mockRestore();
  });

  return (newEnvironmentVariables: EnvVarSet) => {
    setEnvironmentVariables(newEnvironmentVariables);
  };
}
