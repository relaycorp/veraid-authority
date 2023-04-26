import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * Get the local URL to a Knative service.
 *
 * @throws {Error} if the service is not found or `kn` is not installed.
 */
export async function getServiceUrl(serviceName: string): Promise<string> {
  const { stdout } = await execFileAsync('kn', ['service', 'describe', serviceName, '-o', 'url']);
  return stdout.trim();
}
