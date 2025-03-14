import pino, { type LogDescriptor } from 'pino';
import split2 from 'split2';

type MockLogSet = object[];

interface MockLogging {
  readonly logger: pino.Logger;
  readonly logs: MockLogSet;
}

function serialiseLogAttribute(attribute: unknown): unknown {
  if (attribute instanceof URL) {
    return attribute.toString();
  }
  return attribute;
}

export type { MockLogSet };

export function makeMockLogging(): MockLogging {
  const logs: any[] = [];
  const stream = split2((data) => {
    logs.push(JSON.parse(data));
  });
  const logger = pino({ level: 'debug' }, stream);

  beforeEach(() => {
    // Clear the logs
    logs.splice(0, logs.length);
  });

  return { logger, logs };
}

export function partialPinoLog(
  level: pino.Level,
  message: string,
  extraAttributes: LogDescriptor = {},
): any {
  const levelNumber = pino.levels.values[level];
  const attributesSerialised = Object.fromEntries(
    Object.entries(extraAttributes).map(([key, value]) => [key, serialiseLogAttribute(value)]),
  );
  return expect.objectContaining<LogDescriptor>({
    level: levelNumber,
    msg: message,
    ...attributesSerialised,
  });
}
