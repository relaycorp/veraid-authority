import { jest } from '@jest/globals';
import envVar from 'env-var';

import { OAUTH2_JWKS_URL, OAUTH2_TOKEN_AUDIENCE, OAUTH2_TOKEN_ISSUER } from './authn.js';
import { MONGODB_URI } from './db.js';

interface EnvVarSet {
  readonly [key: string]: string | undefined;
}

export const REQUIRED_SERVER_ENV_VARS = {
  AUTHORITY_VERSION: '1.2.3',
  MONGODB_URI,
  OAUTH2_JWKS_URL,
  OAUTH2_TOKEN_AUDIENCE,
  OAUTH2_TOKEN_ISSUER,
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
