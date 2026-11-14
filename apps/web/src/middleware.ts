import { NextRequest, NextResponse } from 'next/server';

// Lightweight access gate for a PRIVATE portfolio/client preview.
// It is not multi-user authentication; use HTTPS and distinct strong secrets.
// Local development stays convenient, but public production fails closed.
function equalText(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const count = Math.max(a.length, b.length);
  for (let i = 0; i < count; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

export function middleware(request: NextRequest) {
  if (process.env.NODE_ENV !== 'production') return NextResponse.next();

  const username = process.env.WEB_ACCESS_USERNAME;
  const password = process.env.WEB_ACCESS_PASSWORD;

  if (!username || !password || password.length < 16) {
    return new NextResponse('Private workspace is not configured.', {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const auth = request.headers.get('authorization') || '';
  let candidateUser = '';
  let candidatePassword = '';
  if (auth.startsWith('Basic ')) {
    try {
      const decoded = atob(auth.slice(6));
      const colon = decoded.indexOf(':');
      if (colon >= 0) {
        candidateUser = decoded.slice(0, colon);
        candidatePassword = decoded.slice(colon + 1);
      }
    } catch { /* Invalid credentials. */ }
  }

  if (!equalText(candidateUser, username) || !equalText(candidatePassword, password)) {
    return new NextResponse('This research workspace is private.', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Link Hunter Workspace", charset="UTF-8"',
        'Cache-Control': 'no-store',
      },
    });
  }

  const response = NextResponse.next();
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
