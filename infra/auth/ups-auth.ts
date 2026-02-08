/**
 * UPS OAuth 2.0 client credentials flow.
 * Tokens expire in 4 hours; this module caches and refreshes automatically.
 * @see https://developer.ups.com/oauth-developer-guide
 */

const TOKEN_PATH = "/security/v1/oauth/token";
const GRANT_TYPE = "client_credentials";
/** Refresh token when this many seconds before expiry (4h = 14400s). */
const REFRESH_BUFFER_SEC = 300;

export interface UpsAuthConfig {
  clientId: string;
  clientSecret: string;
  /** Base URL, e.g. https://wwwcie.ups.com (sandbox) or https://onlinetools.ups.com (prod). */
  baseUrl: string;
}

export interface UpsTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  issued_at: string;
  status: string;
}

interface CachedToken {
  accessToken: string;
  expiresAtMs: number;
}

let cached: CachedToken | null = null;

function b64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return typeof globalThis !== "undefined" && "btoa" in globalThis
    ? (globalThis as { btoa: (s: string) => string }).btoa(binary)
    : "";
}

function parseTokenResponse(body: unknown): UpsTokenResponse {
  if (body && typeof body === "object" && "access_token" in body) {
    const o = body as Record<string, unknown>;
    return {
      access_token: String(o.access_token),
      token_type: typeof o.token_type === "string" ? o.token_type : "Bearer",
      expires_in: Number(o.expires_in) || 0,
      issued_at: typeof o.issued_at === "string" ? o.issued_at : "",
      status: typeof o.status === "string" ? o.status : "",
    };
  }
  throw new Error("Invalid UPS token response: missing access_token");
}

/**
 * Request a new access token from UPS OAuth endpoint.
 */
export async function fetchUpsAccessToken(config: UpsAuthConfig): Promise<UpsTokenResponse> {
  const url = `${config.baseUrl.replace(/\/$/, "")}${TOKEN_PATH}`;
  const credentials = b64(`${config.clientId}:${config.clientSecret}`);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "x-merchant-id": config.clientId,
    },
    body: new URLSearchParams({ grant_type: GRANT_TYPE }).toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`UPS OAuth token request failed: ${res.status} ${res.statusText} - ${text}`);
  }

  const data = (await res.json()) as unknown;
  return parseTokenResponse(data);
}

/**
 * Returns a valid UPS access token, using cache and refreshing when needed.
 * Pass config (e.g. from env: UPS_CLIENT_ID, UPS_CLIENT_SECRET, UPS_API_BASE_URL).
 */
export async function getUpsAccessToken(config: UpsAuthConfig): Promise<string> {
  const nowMs = Date.now();
  const refreshAtMs = nowMs + (REFRESH_BUFFER_SEC * 1000);

  if (cached && cached.expiresAtMs > refreshAtMs) {
    return cached.accessToken;
  }

  const tokenResponse = await fetchUpsAccessToken(config);
  const expiresAtMs = nowMs + tokenResponse.expires_in * 1000;

  cached = {
    accessToken: tokenResponse.access_token,
    expiresAtMs,
  };

  return cached.accessToken;
}

/**
 * Builds an Authorization header value for UPS API requests.
 */
export async function getUpsAuthorizationHeader(config: UpsAuthConfig): Promise<string> {
  const token = await getUpsAccessToken(config);
  return `Bearer ${token}`;
}

/**
 * Clears the in-memory token cache (e.g. for testing or credential rotation).
 */
export function clearUpsTokenCache(): void {
  cached = null;
}
