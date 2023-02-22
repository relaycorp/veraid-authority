import pino, { type LogDescriptor, symbols as PinoSymbols } from 'pino';
import split2 from 'split2';

type MockLogSet = object[];

export interface MockLogging {
  readonly logger: pino.Logger;
  readonly logs: MockLogSet;
}

export function makeMockLogging(): MockLogging {
  const logs: any[] = [];
  const stream = split2((data) => {
    logs.push(JSON.parse(data));
  });
  const logger = pino({ level: 'debug' }, stream);
  return { logger, logs };
}

// eslint-disable-next-line import/no-unused-modules
export function partialPinoLogger(bindings: { readonly [key: string]: any }): any {
  return expect.objectContaining({
    [PinoSymbols.formattersSym]: { bindings },
  });
}

export function partialPinoLog(
  level: pino.Level,
  message: string,
  extraAttributes: LogDescriptor = {},
): any {
  const levelNumber = pino.levels.values[level];
  return expect.objectContaining<LogDescriptor>({
    level: levelNumber,
    msg: message,
    ...extraAttributes,
  });
}
