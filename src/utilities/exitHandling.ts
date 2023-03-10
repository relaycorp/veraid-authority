import type { Logger } from 'pino';

export function configureExitHandling(logger: Logger): void {
  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'uncaughtException');

    process.exitCode = 1;
  });
}
