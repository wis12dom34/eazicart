export interface StoredUser {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
}
export interface AuthStore {
  findUserByEmail(email: string): Promise<StoredUser | undefined>;
  findUserById(id: string): Promise<StoredUser | undefined>;
  createUser(input: Omit<StoredUser, "id">): Promise<StoredUser>;
  saveRefreshToken(input: {
    hash: string;
    userId: string;
    expiresAt: Date;
  }): Promise<void>;
  consumeRefreshToken(hash: string): Promise<string | undefined>;
}

export class MemoryAuthStore implements AuthStore {
  private readonly users = new Map<string, StoredUser>();
  private readonly tokens = new Map<
    string,
    { userId: string; expiresAt: Date }
  >();

  findUserByEmail(email: string): Promise<StoredUser | undefined> {
    return Promise.resolve(
      [...this.users.values()].find((user) => user.email === email),
    );
  }

  findUserById(id: string): Promise<StoredUser | undefined> {
    return Promise.resolve(this.users.get(id));
  }

  createUser(input: Omit<StoredUser, "id">): Promise<StoredUser> {
    const user = { ...input, id: crypto.randomUUID() };
    this.users.set(user.id, user);
    return Promise.resolve(user);
  }

  saveRefreshToken(input: {
    hash: string;
    userId: string;
    expiresAt: Date;
  }): Promise<void> {
    this.tokens.set(input.hash, {
      userId: input.userId,
      expiresAt: input.expiresAt,
    });
    return Promise.resolve();
  }

  consumeRefreshToken(hash: string): Promise<string | undefined> {
    const token = this.tokens.get(hash);
    this.tokens.delete(hash);
    return Promise.resolve(
      token && token.expiresAt > new Date() ? token.userId : undefined,
    );
  }
}
