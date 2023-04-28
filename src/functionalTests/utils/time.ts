import envVar from 'env-var';

const isCi = envVar.get('CI').default('false').asBool();
const CI_WAIT_FACTOR = 2;

export async function sleep(milliseconds: number): Promise<void> {
  const waitMilliseconds = isCi ? milliseconds * CI_WAIT_FACTOR : milliseconds;
  // eslint-disable-next-line promise/avoid-new
  return new Promise((resolve) => {
    setTimeout(resolve, waitMilliseconds);
  });
}
