// A process-wide gate, as opposed to mapWithConcurrency's per-batch limit —
// needed for call sites that issue one-off requests (not a batch) but still
// have to share the same upstream rate-limit budget as every batched caller.
export interface Semaphore {
  acquire: () => Promise<void>;
  release: () => void;
}

export function createSemaphore(limit: number): Semaphore {
  let active = 0;
  const queue: (() => void)[] = [];

  const acquire = () => {
    if (active < limit) {
      active++;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => queue.push(resolve));
  };

  const release = () => {
    const next = queue.shift();
    if (next) {
      // Hand the slot directly to the next waiter instead of decrementing
      // `active` — otherwise a burst of new acquire() calls arriving before
      // the queue drains could squeeze in and exceed the limit.
      next();
    } else {
      active--;
    }
  };

  return { acquire, release };
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let nextIndex = 0;

  async function run() {
    while (nextIndex < items.length) {
      const i = nextIndex++;
      try {
        results[i] = { status: "fulfilled", value: await worker(items[i]!, i) };
      } catch (reason) {
        results[i] = { status: "rejected", reason };
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, run),
  );
  return results;
}
