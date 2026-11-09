import { NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  enforceApiSecurity,
  sanitizeInput,
  getProtectedGoogleClientId,
} from '@/lib/security-shield';
import { recordTeacherLogin } from '@/lib/server-store';

const SESSION_COOKIE_NAME = 'aztool_oauth_session';
const PKCE_VERIFIER_REGEX = /^[A-Za-z0-9\-._~]{43,128}$/;

function createSignedSessionToken(payload: {
  email: string;
  name: string;
  sub?: string;
  iat: number;
  exp: number;
}): string {
  const secret =
    process.env.OAUTH_SESSION_SECRET ||
    process.env.GOOGLE_CLIENT_SECRET ||
    `aztool-pkce-hmac-${getProtectedGoogleClientId()}`;
  const dataB64 = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(dataB64).digest('base64url');
  return `${dataB64}.${sig}`;
}

/**
 * GET /api/auth/google
 * Handles OAuth 2.0 Authorization Code (`response_type=code`) redirect callback.
 * Delivers `{ code, state, error }` back to the opener window via same-origin `postMessage`
 * (or redirects to `/?oauth_code=...&oauth_state=...` if opened in the same tab)
 * so the client can send `code` + `code_verifier` (PKCE) to `POST /api/auth/google`.
 */
export async function GET(req: Request) {
  const blocked = enforceApiSecurity(req, { maxRequests: 60 });
  if (blocked) return blocked;

  const url = new URL(req.url);
  const code = url.searchParams.get('code') || '';
  const state = url.searchParams.get('state') || '';
  const error = url.searchParams.get('error') || '';

  const safePayload = JSON.stringify({
    type: 'AZTOOL_OAUTH_PKCE_CALLBACK',
    code: code.slice(0, 512),
    state: state.slice(0, 256),
    error: error.slice(0, 128),
  });

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <title>AzTool OAuth 2.0 PKCE Verification</title>
</head>
<body style="font-family: system-ui, sans-serif; background: #0f1015; color: #f2f3f7; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
  <div style="text-align: center; padding: 24px;">
    <p style="font-weight: 700; font-size: 14px;">Đang xác thực bảo mật OAuth 2.0 (Code + PKCE)...</p>
  </div>
  <script>
    (function() {
      var payload = ${safePayload};
      try {
        if (window.opener && window.opener !== window) {
          window.opener.postMessage(payload, window.location.origin);
          window.close();
          return;
        }
      } catch (e) {}
      var target = new URL('/', window.location.origin);
      if (payload.code) target.searchParams.set('oauth_code', payload.code);
      if (payload.state) target.searchParams.set('oauth_state', payload.state);
      if (payload.error) target.searchParams.set('oauth_error', payload.error);
      window.location.replace(target.toString());
    })();
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'X-Frame-Options': 'DENY',
    },
  });
}

/**
 * POST /api/auth/google
 * Server-side OAuth 2.0 Authorization Code + PKCE (`code` + `code_verifier`) exchange
 * and OIDC `id_token` verification.
 * NEVER returns raw `access_token` to the browser!
 */
export async function POST(req: Request) {
  const blocked = enforceApiSecurity(req, { maxRequests: 45 });
  if (blocked) return blocked;

  try {
    const rawBody = await req.json();
    const body = sanitizeInput(rawBody);
    const { code, codeVerifier, redirectUri, idToken } = body as {
      code?: string;
      codeVerifier?: string;
      redirectUri?: string;
      idToken?: string;
    };

    const clientId = getProtectedGoogleClientId();
    const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || '').trim();

    let verifiedProfile: {
      email: string;
      name: string;
      picture?: string;
      sub?: string;
      emailVerified?: boolean;
    } | null = null;

    // 1. Authorization Code + PKCE (`code` + `code_verifier`) Exchange on the Server
    if (code && typeof code === 'string') {
      if (codeVerifier && !PKCE_VERIFIER_REGEX.test(codeVerifier)) {
        return NextResponse.json(
          { success: false, error: 'PKCE code_verifier không hợp lệ.' },
          { status: 400 }
        );
      }

      const tokenParams = new URLSearchParams();
      tokenParams.set('grant_type', 'authorization_code');
      tokenParams.set('code', code.trim());
      tokenParams.set('client_id', clientId);
      tokenParams.set('redirect_uri', (redirectUri || 'postmessage').trim());
      if (codeVerifier) {
        tokenParams.set('code_verifier', codeVerifier.trim());
      }
      if (clientSecret) {
        tokenParams.set('client_secret', clientSecret);
      }

      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: tokenParams.toString(),
        cache: 'no-store',
      });

      const tokenData = await tokenRes.json().catch(() => ({}));

      if (!tokenRes.ok || (!tokenData.id_token && !tokenData.access_token)) {
        return NextResponse.json(
          {
            success: false,
            error:
              tokenData?.error_description ||
              tokenData?.error ||
              'Không thể trao đổi Authorization Code + PKCE với Google.',
          },
          { status: 401 }
        );
      }

      // Prefer verifying OIDC `id_token` on the server; fallback to server-side userinfo fetch
      if (tokenData.id_token) {
        const infoRes = await fetch(
          `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(
            tokenData.id_token
          )}`,
          { cache: 'no-store' }
        );
        if (infoRes.ok) {
          const info = await infoRes.json();
          if (info.aud === clientId && info.email) {
            verifiedProfile = {
              email: String(info.email).trim().toLowerCase(),
              name: info.name || info.given_name || String(info.email).split('@')[0],
              picture: info.picture,
              sub: info.sub,
              emailVerified: info.email_verified === 'true' || info.email_verified === true,
            };
          }
        }
      }

      if (!verifiedProfile && tokenData.access_token) {
        // Fetch userinfo strictly on the server — NEVER send `access_token` to the client!
        const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
          },
          cache: 'no-store',
        });
        if (userInfoRes.ok) {
          const uInfo = await userInfoRes.json();
          if (uInfo?.email) {
            verifiedProfile = {
              email: String(uInfo.email).trim().toLowerCase(),
              name: uInfo.name || uInfo.given_name || String(uInfo.email).split('@')[0],
              picture: uInfo.picture,
              sub: uInfo.sub,
              emailVerified: Boolean(uInfo.email_verified),
            };
          }
        }
      }
    }

    // 2. Signed OIDC `id_token` Server-Side Verification (No `access_token` in browser)
    if (!verifiedProfile && idToken && typeof idToken === 'string') {
      const infoRes = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(
          idToken.trim()
        )}`,
        { cache: 'no-store' }
      );
      if (infoRes.ok) {
        const info = await infoRes.json();
        if (info.aud === clientId && info.email) {
          verifiedProfile = {
            email: String(info.email).trim().toLowerCase(),
            name: info.name || info.given_name || String(info.email).split('@')[0],
            picture: info.picture,
            sub: info.sub,
            emailVerified: info.email_verified === 'true' || info.email_verified === true,
          };
        }
      }
    }

    if (!verifiedProfile || !verifiedProfile.email) {
      return NextResponse.json(
        {
          success: false,
          error: 'Xác thực OAuth 2.0 (Code + PKCE) không thành công hoặc phiên đã hết hạn.',
        },
        { status: 401 }
      );
    }

    // Record teacher login in unified server & cloud store
    const { state, user: loggedInUser } = await recordTeacherLogin({
      email: verifiedProfile.email,
      displayName: verifiedProfile.name,
      photoURL: verifiedProfile.picture,
    });

    const nowSec = Math.floor(Date.now() / 1000);
    const sessionToken = createSignedSessionToken({
      email: verifiedProfile.email,
      name: verifiedProfile.name,
      sub: verifiedProfile.sub,
      iat: nowSec,
      exp: nowSec + 7 * 24 * 3600,
    });

    const response = NextResponse.json(
      {
        success: true,
        authMethod: 'oauth2_code_pkce_s256',
        profile: {
          email: verifiedProfile.email,
          name: verifiedProfile.name,
          picture: verifiedProfile.picture,
        },
        user: loggedInUser,
        permissions: state.permissions,
        users: state.users,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );

    response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 3600,
    });

    return response;
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'Lỗi máy chủ khi xử lý OAuth 2.0 Code + PKCE.',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  const blocked = enforceApiSecurity(req, { maxRequests: 60 });
  if (blocked) return blocked;

  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}
