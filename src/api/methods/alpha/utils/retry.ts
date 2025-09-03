export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function retryWithJitter<T>(
  fn: () => Promise<T>,
  {
    maxAttempts = 2,
    baseDelayMs = 300,
  }: { maxAttempts?: number; baseDelayMs?: number } = {}
): Promise<T> {
  let attempt = 0;
  let lastErr: unknown;
  while (attempt < maxAttempts) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      attempt += 1;
      if (attempt >= maxAttempts) break;
      const jitter = 0.5 + Math.random(); // 0.5..1.5
      const delay = Math.round(baseDelayMs * Math.pow(2, attempt - 1) * jitter);
      await sleep(delay);
    }
  }
  throw lastErr;
}

export async function withTimeout<T>(p: Promise<T>, ms: number, label = "operation"): Promise<T> {
  let to: NodeJS.Timeout;
  const timeout = new Promise<never>((_, rej) => {
    to = setTimeout(() => rej(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  try {
    const res = await Promise.race([p, timeout]);
    // @ts-ignore
    return res;
  } finally {
    // @ts-ignore
    clearTimeout(to);
  }
}
