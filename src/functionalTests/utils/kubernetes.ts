import { spawn } from 'node:child_process';

import getPort from 'get-port';

const COMMAND_TIMEOUT_SECONDS = 3000;

type Command = (port: number) => Promise<void>;

export async function connectToClusterService(
  serviceName: string,
  servicePort: number,
  command: Command,
): Promise<unknown> {
  const localPort = await getPort();

  const abortController = new AbortController();
  const kubectlArgs = ['port-forward', `svc/${serviceName}`, `${localPort}:${servicePort}`];

  // eslint-disable-next-line promise/avoid-new
  return new Promise<void>((resolve, reject) => {
    const kubectlPortForward = spawn('kubectl', kubectlArgs, {
      signal: abortController.signal,
      timeout: COMMAND_TIMEOUT_SECONDS,
    });

    let stderr = '';
    kubectlPortForward.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    kubectlPortForward.once('error', (error) => {
      reject(new Error(`Failed to start port-forward ${serviceName}: ${error.message}\n${stderr}`));
    });

    kubectlPortForward.once('close', (exitCode) => {
      if (exitCode !== null && 0 < exitCode) {
        reject(
          new Error(`Port forwarder for ${serviceName} exited with code ${exitCode}:\n${stderr}`),
        );
      } else {
        resolve();
      }
    });

    kubectlPortForward.once('spawn', () => {
      // eslint-disable-next-line promise/catch-or-return
      command(localPort)
        // eslint-disable-next-line promise/prefer-await-to-then
        .then(resolve, reject)
        // eslint-disable-next-line promise/prefer-await-to-then
        .finally(() => {
          abortController.abort();
        });
    });
  });
}
