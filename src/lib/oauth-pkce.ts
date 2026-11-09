/**
 * RFC 7636 OAuth 2.0 Proof Key for Code Exchange (PKCE) & State CSRF Protection
 * Replaces legacy Implicit Grant (`response_type=token`) with `response_type=code` + `S256`.
 */

const PKCE_SESSION_STORAGE_KEY = 'aztool_oauth_pkce_session_v1';
const PKCE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export interface PkceSessionData {
  state: string;
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: 'S256';
  redirectUri: string;
  createdAt: number;
}

/**
 * Encodes a byte array into Base64URL format (RFC 4648 §5) without padding.
 */
function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Generates a cryptographically random `code_verifier` (RFC 7636 §4.1: 43-128 chars).
 */
export function generateCodeVerifier(byteLength = 64): string {
  const randomBytes = new Uint8Array(byteLength);
  window.crypto.getRandomValues(randomBytes);
  return base64UrlEncode(randomBytes);
}

/**
 * Computes `code_challenge = BASE64URL-ENCODE(SHA256(ASCII(code_verifier)))` (RFC 7636 §4.2).
 */
export async function generateCodeChallengeS256(codeVerifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digestBuffer = await window.crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digestBuffer));
}

/**
 * Generates a cryptographically strong random `state` token to prevent CSRF attacks.
 */
export function generateOAuthState(byteLength = 32): string {
  const randomBytes = new Uint8Array(byteLength);
  window.crypto.getRandomValues(randomBytes);
  return base64UrlEncode(randomBytes);
}

/**
 * Creates and persists a single-use PKCE session in `sessionStorage`.
 */
export async function createPkceSession(redirectUri: string): Promise<PkceSessionData> {
  const codeVerifier = generateCodeVerifier(64);
  const codeChallenge = await generateCodeChallengeS256(codeVerifier);
  const state = generateOAuthState(32);

  const session: PkceSessionData = {
    state,
    codeVerifier,
    codeChallenge,
    codeChallengeMethod: 'S256',
    redirectUri,
    createdAt: Date.now(),
  };

  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem(PKCE_SESSION_STORAGE_KEY, JSON.stringify(session));
    } catch {
      // ignore storage errors
    }
  }

  return session;
}

/**
 * Constant-time string comparison to mitigate timing attacks on OAuth `state`.
 */
function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Validates the returned `state` and consumes the single-use `code_verifier` from `sessionStorage`.
 */
export function consumePkceSession(returnedState?: string | null): PkceSessionData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(PKCE_SESSION_STORAGE_KEY);
    sessionStorage.removeItem(PKCE_SESSION_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as PkceSessionData;
    if (!parsed || !parsed.codeVerifier || !parsed.state) return null;

    // Enforce 10-minute expiration
    if (Date.now() - (parsed.createdAt || 0) > PKCE_TTL_MS) {
      return null;
    }

    // Verify CSRF state if returnedState is provided
    if (returnedState && !timingSafeEqualStr(parsed.state, returnedState)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

/**
 * Builds the Google OAuth 2.0 Authorization Endpoint URL using `response_type=code` + PKCE (`S256`).
 */
export function buildGooglePkceAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
}): string {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', params.clientId);
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('code_challenge', params.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('state', params.state);
  url.searchParams.set('access_type', 'online');
  url.searchParams.set('include_granted_scopes', 'true');
  url.searchParams.set('prompt', 'select_account');
  return url.toString();
}
