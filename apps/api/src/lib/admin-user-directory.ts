import type { AccountRole, AccountStatus } from "@iride/types";

interface DirectoryProfile {
  readonly id: string;
  readonly username: string | null;
  readonly displayName: string | null;
  readonly createdAt: string;
}

interface DirectoryAccess {
  readonly userId: string;
  readonly role: AccountRole;
  readonly status: AccountStatus;
  readonly updatedAt: string;
}

interface DirectoryAuthUser {
  readonly id: string;
  readonly email?: string | null;
}

interface AuthUsersPage {
  readonly data: { readonly users: readonly DirectoryAuthUser[]; readonly total?: number };
  readonly error: unknown;
}

interface DirectoryUser {
  readonly id: string;
  readonly username: string | null;
  readonly displayName: string | null;
  readonly email: string | null;
  readonly role: AccountRole;
  readonly status: AccountStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface AuthUserResult {
  readonly data: { readonly user: DirectoryAuthUser | null };
  readonly error: unknown;
}

export function searchAdminUserDirectory(input: {
  readonly profiles: readonly DirectoryProfile[];
  readonly access: readonly DirectoryAccess[];
  readonly authUsers: readonly DirectoryAuthUser[];
  readonly q: string;
  readonly page: number;
  readonly pageSize: number;
}) {
  const normalizedQuery = input.q.trim().toLocaleLowerCase("en");
  const accessByUser = new Map(input.access.map((item) => [item.userId, item]));
  const authByUser = new Map(input.authUsers.map((item) => [item.id, item]));
  const matches = input.profiles.flatMap((profile) => {
    const account = accessByUser.get(profile.id);
    if (!account) return [];
    const email = authByUser.get(profile.id)?.email ?? null;
    const fields = [profile.displayName, profile.username, email];
    if (normalizedQuery && !fields.some((value) => value?.toLocaleLowerCase("en").includes(normalizedQuery))) {
      return [];
    }
    return [{
      id: profile.id,
      username: profile.username,
      displayName: profile.displayName,
      email,
      role: account.role,
      status: account.status,
      createdAt: profile.createdAt,
      updatedAt: account.updatedAt,
    }];
  }).sort((left, right) => right.createdAt.localeCompare(left.createdAt) || left.id.localeCompare(right.id));
  const offset = (input.page - 1) * input.pageSize;
  return { data: matches.slice(offset, offset + input.pageSize), total: matches.length };
}

export async function loadAllAuthUsers(
  listUsers: (params: { readonly page: number; readonly perPage: number }) => Promise<AuthUsersPage>,
) {
  const users: DirectoryAuthUser[] = [];
  for (let page = 1; ; page += 1) {
    const result = await listUsers({ page, perPage: 1000 });
    if (result.error) throw result.error;
    users.push(...result.data.users);
    const total = result.data.total ?? users.length;
    if (result.data.users.length === 0 || users.length >= total) return users;
  }
}

export async function enrichAdminUsersWithEmails(
  users: readonly DirectoryUser[],
  getUserById: (id: string) => Promise<AuthUserResult>,
) {
  const enriched: DirectoryUser[] = [];
  for (let offset = 0; offset < users.length; offset += 5) {
    enriched.push(...await Promise.all(users.slice(offset, offset + 5).map(async (user) => {
      const result = await getUserById(user.id);
      if (result.error) throw result.error;
      return { ...user, email: result.data.user?.email ?? null };
    })));
  }
  return enriched;
}
