export type ProfileQuery = Readonly<
  Record<string, string | string[] | undefined>
>;

export function ownProfileRedirect(
  username: string,
  ownUsername: string | null,
  query: ProfileQuery,
) {
  if (!ownUsername || username.toLowerCase() !== ownUsername.toLowerCase())
    return null;
  return ownProfileHref(query);
}

export function ownProfileHref(query: ProfileQuery) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) value.forEach((item) => search.append(key, item));
    else if (value !== undefined) search.append(key, value);
  }
  return `/profile${search.size ? `?${search}` : ""}`;
}

export function profileTabHref(username: string, tab: string, owner = false) {
  const base = owner ? "/profile" : `/users/${encodeURIComponent(username)}`;
  return tab === "overview" ? base : `${base}?tab=${tab}`;
}
