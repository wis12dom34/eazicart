/** Keep local credential changes ordered and prevent stale auth work from reviving a session. */
export type SessionTokens = { accessToken: string; refreshToken: string };

type TokenStorage = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
};

export function createSessionPersistence(
  storageKey: string,
  storage: TokenStorage,
  publishAccessToken: (token: string | null) => void,
) {
  let generation = 0;
  let queue: Promise<void> = Promise.resolve();

  function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const work = queue.then(operation);
    // A failed storage call must not permanently block future logout/cleanup.
    queue = work.then(() => undefined, () => undefined);
    return work;
  }

  const current = () => generation;
  const isCurrent = (stamp: number) => stamp === generation;

  function read(stamp: number): Promise<string | null> {
    return enqueue(async () => {
      if (!isCurrent(stamp)) return null;
      const token = await storage.getItemAsync(storageKey);
      return isCurrent(stamp) ? token : null;
    });
  }

  function persist(stamp: number, tokens: SessionTokens): Promise<boolean> {
    return enqueue(async () => {
      if (!isCurrent(stamp)) return false;
      await storage.setItemAsync(storageKey, tokens.refreshToken);
      // Logout can begin while the secure-store write is pending.
      if (!isCurrent(stamp)) return false;
      publishAccessToken(tokens.accessToken);
      return true;
    });
  }

  /** Invalidate synchronously, then revoke the local refresh token in write order. */
  function clear(): Promise<string | null> {
    generation += 1;
    publishAccessToken(null);
    return enqueue(async () => {
      let previousToken: string | null = null;
      try {
        previousToken = await storage.getItemAsync(storageKey);
      } catch {
        // A read error must not prevent local token deletion on logout.
      }
      await storage.deleteItemAsync(storageKey);
      return previousToken;
    });
  }

  /** A stale 401 response cannot erase a subsequent login. */
  function clearIfCurrent(stamp: number): Promise<boolean> {
    if (!isCurrent(stamp)) return Promise.resolve(false);
    generation += 1;
    publishAccessToken(null);
    return enqueue(async () => {
      await storage.deleteItemAsync(storageKey);
      return true;
    });
  }

  return { current, isCurrent, read, persist, clear, clearIfCurrent };
}
