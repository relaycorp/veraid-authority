import { jest } from '@jest/globals';
import envVar from 'env-var';

import { K_SINK, POHTTP_TLS_REQUIRED } from './eventing/stubs.js';
import { MONGODB_URI } from './db.js';

export interface EnvVarSet {
  readonly [key: string]: string | undefined;
}

export const REQUIRED_ENV_VARS = {
  AUTHORITY_VERSION: '1.2.3',
  K_SINK,
  MONGODB_URI,
  POHTTP_TLS_REQUIRED,
};

export type EnvVarMocker = (envVars: EnvVarSet) => void;

export function configureMockEnvVars(envVars: EnvVarSet = {}): EnvVarMocker {
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
