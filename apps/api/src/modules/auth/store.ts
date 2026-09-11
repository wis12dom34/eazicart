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
  async findUserByEmail(email: string) {
    return [...this.users.values()].find((user) => user.email === email);
  }
  async findUserById(id: string) {
    return this.users.get(id);
  }
  async createUser(input: Omit<StoredUser, "id">) {
    const user = { ...input, id: crypto.randomUUID() };
    this.users.set(user.id, user);
    return user;
  }
  async saveRefreshToken(input: {
    hash: string;
    userId: string;
    expiresAt: Date;
  }) {
    this.tokens.set(input.hash, {
      userId: input.userId,
      expiresAt: input.expiresAt,
    });
  }
  async consumeRefreshToken(hash: string) {
    const token = this.tokens.get(hash);
    this.tokens.delete(hash);
    return token && token.expiresAt > new Date() ? token.userId : undefined;
  }
}
