import { jest } from '@jest/globals';

import { mockSpy } from '../testUtils/jest.js';
import { makeMockLogging, partialPinoLog } from '../testUtils/logging.js';

import { configureExitHandling } from './exitHandling.js';

const ERROR = new Error('Oh noes');

const mockLogging = makeMockLogging();

const mockProcessOn = mockSpy(jest.spyOn(process, 'on'));

describe('configureExitHandling', () => {
  beforeEach(() => {
    configureExitHandling(mockLogging.logger);
  });
  afterEach(() => {
    process.exitCode = undefined;
  });

  describe('uncaughtException', () => {
    test('Error should be logged as fatal', () => {
      const [[, handler]] = mockProcessOn.mock.calls;

      handler(ERROR);

      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('fatal', 'uncaughtException', {
          err: expect.objectContaining({ message: ERROR.message }),
        }),
      );
    });

    test('Process should exit with code 1', () => {
      const [[, handler]] = mockProcessOn.mock.calls;
      expect(process.exitCode).toBeUndefined();

      handler(ERROR);

      expect(process.exitCode).toBe(1);
    });
  });
});
