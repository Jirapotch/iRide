import {
  createSign,
  generateKeyPairSync,
  randomUUID,
} from "node:crypto";
import { Buffer } from "node:buffer";
import { createServer } from "node:http";
import { URL } from "node:url";

export const MOCK_SUPABASE_PORT = 54321;
export const MOCK_SUPABASE_URL = `http://127.0.0.1:${MOCK_SUPABASE_PORT}`;
export const MOCK_PUBLISHABLE_KEY = "sb_publishable_e2e_auth_mock";
export const MOCK_USER_ID = "11111111-1111-4111-8111-111111111111";

const keyId = "iride-e2e-es256";
const { privateKey, publicKey } = generateKeyPairSync("ec", {
  namedCurve: "prime256v1",
});
const publicJwk = publicKey.export({ format: "jwk" });

export function startMockSupabaseAuth() {
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
    return (
      callback.origin === "http://127.0.0.1:3000" &&
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

function json(response, status, body) {
  const value = JSON.stringify(body);
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(value),
    "Content-Type": "application/json",
  });
  response.end(value);
}
