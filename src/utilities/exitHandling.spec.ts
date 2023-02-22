import { jest } from '@jest/globals';

import { getMockContext, mockSpy } from '../testUtils/jest.js';
import { makeMockLogging, type MockLogging, partialPinoLog } from '../testUtils/logging.js';

import { configureExitHandling } from './exitHandling.js';

const ERROR = new Error('Oh noes');

let mockLogging: MockLogging;
beforeEach(() => {
  mockLogging = makeMockLogging();
});

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
      const [[, handler]] = getMockContext(mockProcessOn).calls;

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      handler(ERROR);

      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('fatal', 'uncaughtException', {
          err: expect.objectContaining({ message: ERROR.message }),
        }),
      );
    });

    test('Process should exit with code 1', () => {
      const [[, handler]] = getMockContext(mockProcessOn).calls;
      expect(process.exitCode).toBeUndefined();

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      handler(ERROR);

      expect(process.exitCode).toBe(1);
    });
  });
});
