import { createSign, generateKeyPairSync, randomUUID } from "node:crypto";
import { Buffer } from "node:buffer";
import { createServer } from "node:http";
import process from "node:process";
import { URL } from "node:url";

export const MOCK_SUPABASE_PORT = 54321;
export const MOCK_SUPABASE_URL = `http://127.0.0.1:${MOCK_SUPABASE_PORT}`;
export const MOCK_PUBLISHABLE_KEY = "sb_publishable_e2e_auth_mock";
export const MOCK_USER_ID = "11111111-1111-4111-8111-111111111111";
export const MOCK_TARGET_USER_ID = "22222222-2222-4222-8222-222222222222";

const keyId = "iride-e2e-es256";
const { privateKey, publicKey } = generateKeyPairSync("ec", {
  namedCurve: "prime256v1",
});
const publicJwk = publicKey.export({ format: "jwk" });
let profile = completeProfile();
let accountAccess = completeAccountAccess();
let targetAccess = targetAccountAccess();
let posts = new Map();
let events = new Map();

export function startMockSupabaseAuth() {
  events = new Map();
  accountAccess = completeAccountAccess();
  targetAccess = targetAccountAccess();
  posts = new Map();
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", MOCK_SUPABASE_URL);

    if (
      request.method === "GET" &&
      url.pathname === "/auth/v1/.well-known/jwks.json"
    ) {
      return json(response, 200, {
        keys: [
          {
            ...publicJwk,
            alg: "ES256",
            key_ops: ["verify"],
            kid: keyId,
            use: "sig",
          },
        ],
      });
    }

    if (request.method === "GET" && url.pathname === "/auth/v1/authorize") {
      const redirectTo = url.searchParams.get("redirect_to");
      if (!redirectTo || !isAllowedCallback(redirectTo)) {
        return json(response, 400, { error: "invalid_redirect" });
      }

      const callback = new URL(redirectTo);
      callback.searchParams.set("code", "iride-e2e-oauth-code");
      response.writeHead(302, { Location: callback.toString() });
      return response.end();
    }

    if (
      request.method === "POST" &&
      url.pathname === "/auth/v1/token" &&
      url.searchParams.get("grant_type") === "pkce"
    ) {
      await readBody(request);
      return json(response, 200, createSessionResponse());
    }

    if (request.method === "POST" && url.pathname === "/auth/v1/logout") {
      await readBody(request);
      response.writeHead(204);
      return response.end();
    }

    if (request.method === "POST" && url.pathname === "/test/profiles/reset") {
      const body = await readJsonBody(request);
      profile =
        body?.complete === false ? incompleteProfile() : completeProfile();
      return json(response, 200, { data: profile });
    }

    if (request.method === "POST" && url.pathname === "/test/account-access") {
      const body = await readJsonBody(request);
      accountAccess = { ...accountAccess, status: body?.status === "locked" ? "locked" : "active", role: body?.role === "user" ? "user" : "admin", updated_at: new Date().toISOString() };
      return json(response, 200, { data: accountAccess });
    }

    if (request.method === "GET" && url.pathname === "/rest/v1/account_access") {
      const ids = filterValues(url.searchParams.get("user_id"));
      const rows = [accountAccess, targetAccess].filter((item) => !ids || ids.includes(item.user_id));
      return postgrestJson(response, postgrestBody(request, rows, rows[0] ?? null));
    }

    if (request.method === "GET" && url.pathname === "/rest/v1/profiles") {
      const ids = filterValues(url.searchParams.get("id"));
      const username = filterValue(url.searchParams.get("username"));
      const rows = [profile, targetProfile()].filter((item) => (!ids || ids.includes(item.id)) && (!username || username === item.username));
      return postgrestJson(response, postgrestBody(request, rows, rows[0] ?? null));
    }

    if (request.method === "PUT" && url.pathname.startsWith("/auth/v1/admin/users/")) {
      await readJsonBody(request);
      return json(response, 200, { user: { id: url.pathname.split("/").at(-1) } });
    }

    if (request.method === "POST" && url.pathname === "/rest/v1/rpc/begin_account_access_transition") {
      const body = await readJsonBody(request);
      const previous = targetAccess.status;
      const next = body?.requested_action === "unlock" || body?.requested_action === "restore" ? "active" : body?.requested_action === "suspend" ? "suspended" : "locked";
      targetAccess = { ...targetAccess, status: next, transition_id: "33333333-3333-4333-8333-333333333333", transition_action: body?.requested_action, transition_previous_status: previous, transition_actor_id: body?.actor_id, updated_at: new Date().toISOString() };
      return postgrestJson(response, postgrestBody(request, [transitionRow(targetAccess, previous)], transitionRow(targetAccess, previous)));
    }

    if (request.method === "POST" && url.pathname === "/rest/v1/rpc/finalize_account_access_transition") {
      await readJsonBody(request);
      targetAccess = { ...targetAccess, transition_id: null, transition_action: null, transition_previous_status: null, transition_actor_id: null, updated_at: new Date().toISOString() };
      const row = { role: targetAccess.role, status: targetAccess.status, updated_at: targetAccess.updated_at };
      return postgrestJson(response, postgrestBody(request, [row], row));
    }

    if (request.method === "POST" && url.pathname === "/rest/v1/rpc/save_post_with_markers") {
      const body = await readJsonBody(request);
      const id = body?.target_post_id || randomUUID();
      const timestamp = new Date().toISOString();
      posts.set(id, { id, author_id: MOCK_USER_ID, body: body?.post_body ?? "", community_category: body?.post_community_category ?? "groups", deleted_at: null, created_at: posts.get(id)?.created_at ?? timestamp, updated_at: timestamp });
      return postgrestJson(response, id);
    }

    if (request.method === "GET" && url.pathname === "/rest/v1/posts") {
      const ids = filterValues(url.searchParams.get("id"));
      const authorId = filterValue(url.searchParams.get("author_id"));
      const category = filterValue(url.searchParams.get("community_category"));
      const rows = Array.from(posts.values()).filter((item) => (!ids || ids.includes(item.id)) && (!authorId || item.author_id === authorId) && (!category || item.community_category === category) && !item.deleted_at);
      return postgrestJson(response, postgrestBody(request, rows, rows[0] ?? null));
    }

    if (request.method === "GET" && ["/rest/v1/comments", "/rest/v1/post_marker_tags", "/rest/v1/photographer_spots", "/rest/v1/vehicles"].includes(url.pathname)) {
      return postgrestJson(response, postgrestBody(request, [], null));
    }

    if (url.pathname === "/rest/v1/events") {
      if (request.method === "POST") {
        const input = await readJsonBody(request);
        if (!input || typeof input !== "object") {
          return postgrestError(response, 400, "PGRST102", "invalid event");
        }
        const timestamp = new Date().toISOString();
        const event = {
          ...input,
          id: randomUUID(),
          created_at: timestamp,
          updated_at: timestamp,
        };
        events.set(event.id, event);
        return postgrestJson(
          response,
          postgrestBody(request, [event], event),
          201,
        );
      }
      if (request.method === "GET") {
        const ids = filterValues(url.searchParams.get("id"));
        const rows = Array.from(events.values()).filter(
          (event) => !ids || ids.includes(event.id),
        );
        return postgrestJson(
          response,
          postgrestBody(request, rows, rows[0] ?? null),
        );
      }
    }

    if (
      request.method === "GET" &&
      url.pathname === "/rest/v1/market_products"
    ) {
      const id = filterValue(url.searchParams.get("id"));
      const product = marketProduct();
      return postgrestJson(response, !id || id === product.id ? [product] : []);
    }

    if (request.method === "PATCH" && url.pathname === "/rest/v1/profiles") {
      const id = filterValue(url.searchParams.get("id"));
      const body = await readJsonBody(request);
      if (id !== MOCK_USER_ID || !body || typeof body !== "object") {
        return postgrestError(response, 400, "PGRST116", "profile_not_found");
      }
      if (body.username === "taken_name") {
        return postgrestError(response, 409, "23505", "duplicate key value");
      }
      if (
        typeof body.username === "string" &&
        profile.username &&
        body.username !== profile.username
      ) {
        return postgrestError(response, 400, "P0001", "username_cooldown");
      }
      profile = {
        ...profile,
        ...body,
        username_changed_at:
          typeof body.username === "string" &&
          body.username !== profile.username
            ? new Date().toISOString()
            : profile.username_changed_at,
        updated_at: new Date().toISOString(),
      };
      response.writeHead(204, { "Cache-Control": "no-store" });
      return response.end();
    }

    return json(response, 404, { error: "not_found" });
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(MOCK_SUPABASE_PORT, "127.0.0.1", () => resolve(server));
  });
}

function createSessionResponse() {
  const now = Math.floor(Date.now() / 1000);
  const accessToken = signJwt({
    aal: "aal1",
    amr: [{ method: "oauth", timestamp: now }],
    app_metadata: { provider: "google", providers: ["google"] },
    aud: "authenticated",
    email: "oauth-user@iride.test",
    exp: now + 3_600,
    iat: now,
    is_anonymous: false,
    iss: `${MOCK_SUPABASE_URL}/auth/v1`,
    role: "authenticated",
    session_id: "22222222-2222-4222-8222-222222222222",
    sub: MOCK_USER_ID,
    user_metadata: {},
  });
  const timestamp = new Date(now * 1_000).toISOString();

  return {
    access_token: accessToken,
    expires_at: now + 3_600,
    expires_in: 3_600,
    refresh_token: `e2e-refresh-${randomUUID()}`,
    token_type: "bearer",
    user: {
      id: MOCK_USER_ID,
      aud: "authenticated",
      role: "authenticated",
      email: "oauth-user@iride.test",
      email_confirmed_at: timestamp,
      phone: "",
      confirmed_at: timestamp,
      last_sign_in_at: timestamp,
      app_metadata: { provider: "google", providers: ["google"] },
      user_metadata: {},
      identities: [],
      created_at: timestamp,
      updated_at: timestamp,
      is_anonymous: false,
    },
  };
}

function signJwt(payload) {
  const header = encodeJson({ alg: "ES256", kid: keyId, typ: "JWT" });
  const body = encodeJson(payload);
  const signer = createSign("SHA256");
  signer.update(`${header}.${body}`);
  signer.end();
  const signature = signer.sign({ key: privateKey, dsaEncoding: "ieee-p1363" });
  return `${header}.${body}.${signature.toString("base64url")}`;
}

function encodeJson(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function isAllowedCallback(value) {
  try {
    const callback = new URL(value);
    const webPort = process.env.E2E_WEB_PORT ?? "3000";
    return (
      callback.origin === `http://127.0.0.1:${webPort}` &&
      callback.pathname === "/auth/callback"
    );
  } catch {
    return false;
  }
}

async function readBody(request) {
  for await (const chunk of request) {
    // Drain the request body before responding.
    if (!chunk) break;
  }
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (!chunks.length) return null;
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return null;
  }
}

function filterValue(value) {
  return value?.startsWith("eq.") ? value.slice(3) : null;
}

function filterValues(value) {
  const exact = filterValue(value);
  if (exact) return [exact];
  if (!value?.startsWith("in.(") || !value.endsWith(")")) return null;
  return value.slice(4, -1).split(",");
}

function postgrestBody(request, rows, single = rows) {
  return request.headers.accept?.includes("application/vnd.pgrst.object+json")
    ? single
    : rows;
}

function completeProfile() {
  const timestamp = "2026-08-27T00:00:00.000Z";
  return {
    id: MOCK_USER_ID,
    username: "e2e_rider",
    display_name: "E2E Rider",
    bio: "Roads and stories",
    avatar_media_id: null,
    cover_media_id: null,
    location_name: "Bangkok",
    latitude: 13.7563,
    longitude: 100.5018,
    visibility: "public",
    username_changed_at: timestamp,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

function completeAccountAccess() {
  return {
    user_id: MOCK_USER_ID,
    role: "admin",
    status: "active",
    transition_id: null,
    transition_action: null,
    transition_previous_status: null,
    transition_actor_id: null,
    created_at: "2026-08-27T00:00:00.000Z",
    updated_at: "2026-08-27T00:00:00.000Z",
  };
}

function targetAccountAccess() {
  return { ...completeAccountAccess(), user_id: MOCK_TARGET_USER_ID, role: "user", status: "locked" };
}

function targetProfile() {
  return { ...completeProfile(), id: MOCK_TARGET_USER_ID, username: "locked_rider", display_name: "Locked Rider" };
}

function transitionRow(access, previousStatus) {
  return { role: access.role, status: access.status, updated_at: access.updated_at, transition_token: access.transition_id, previous_status: previousStatus };
}

function incompleteProfile() {
  const timestamp = "2026-08-27T00:00:00.000Z";
  return {
    ...completeProfile(),
    username: null,
    display_name: null,
    bio: null,
    location_name: null,
    latitude: null,
    longitude: null,
    username_changed_at: null,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

function marketProduct() {
  const timestamp = "2026-08-29T00:00:00.000Z";
  return {
    id: "00000000-0000-4000-8000-000000000001",
    owner_id: MOCK_USER_ID,
    name: "Touring helmet",
    price_satang: 490000,
    currency: "THB",
    category: "Protection",
    vehicle_kinds: ["motorcycle"],
    cover_media_id: null,
    deleted_at: null,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

function postgrestJson(response, body, status = 200) {
  const value = JSON.stringify(body);
  const rows = Array.isArray(body) ? body : body ? [body] : [];
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(value),
    "Content-Type": "application/json",
    "Content-Range": rows.length
      ? `0-${rows.length - 1}/${rows.length}`
      : "*/0",
  });
  response.end(value);
}

function postgrestError(response, status, code, message) {
  return json(response, status, { code, details: null, hint: null, message });
}

function json(response, status, body) {
  const value = JSON.stringify(body);
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(value),
    "Content-Type": "application/json",
  });
  response.end(value);
}
