export interface PublicDatabaseConfig {
  readonly url: string;
  readonly publishableKey: string;
}

export interface ServerDatabaseConfig extends PublicDatabaseConfig {
  readonly accessToken?: string;
}

export interface AdminDatabaseConfig {
  readonly url: string;
  readonly serviceRoleKey: string;
}

export function requireDatabaseValue(value: string, name: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`${name} is required`);
  }

  return normalized;
}
