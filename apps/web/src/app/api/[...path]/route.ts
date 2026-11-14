import { NextRequest, NextResponse } from 'next/server';
import { getPrimaryApiSecret } from '@discord-link-hunter/config';

// Server-only destination. Never add this to NEXT_PUBLIC_* in production.
const BACKEND_BASE = (
  process.env.API_BASE_URL ||
  (process.env.NODE_ENV === 'production' ? '' : (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:3001'))
).replace(/\/$/, '');

async function proxyRequest(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> | { path: string[] } }
) {
  // apps/web/src/middleware.ts authenticates site visitors before this
  // server-side route receives their request. No browser API key is accepted.
  const secret = getPrimaryApiSecret();
  if (!secret || !BACKEND_BASE) {
    return NextResponse.json({ error: 'Server API configuration incomplete' }, { status: 503 });
  }

  const resolvedParams = await context.params;
  const segments = resolvedParams?.path;
  if (!Array.isArray(segments) || segments.some((p) => !p || p === '.' || p === '..' || p.includes('/') || p.includes('\\'))) {
    return NextResponse.json({ error: 'Invalid API path' }, { status: 400 });
  }
  const url = `${BACKEND_BASE}/api/${segments.map(encodeURIComponent).join('/')}${request.nextUrl.search}`;

  // Only forward the headers required by our API. Discard browser-supplied
  // Authorization, x-api-key, cookies and forwarding headers.
  const headers = new Headers();
  headers.set('x-api-key', secret);
  const accept = request.headers.get('accept');
  const contentType = request.headers.get('content-type');
  if (accept) headers.set('accept', accept);
  if (contentType) headers.set('content-type', contentType);

  const init: RequestInit = { method: request.method, headers, cache: 'no-store' };
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
    const body = await request.arrayBuffer();
    if (body.byteLength) init.body = body;
  }

  try {
    const backendRes = await fetch(url, init);
    const resHeaders = new Headers();
    for (const header of ['content-type', 'content-disposition']) {
      const value = backendRes.headers.get(header);
      if (value) resHeaders.set(header, value);
    }
    resHeaders.set('cache-control', 'no-store');

    return new NextResponse(backendRes.body, {
      status: backendRes.status,
      headers: resHeaders,
    });
  } catch {
    // Avoid leaking internal infrastructure addresses to the browser.
    return NextResponse.json({ error: 'Backend temporarily unavailable' }, { status: 502 });
  }
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const DELETE = proxyRequest;
export const PATCH = proxyRequest;
export const OPTIONS = proxyRequest;
