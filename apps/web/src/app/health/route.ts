import { NextResponse } from 'next/server';

// Same-origin health check avoids exposing the backend URL in a browser rewrite.
// The site's middleware still protects this route in production.
export async function GET() {
  const base = (
    process.env.API_BASE_URL ||
    (process.env.NODE_ENV === 'production'
      ? ''
      : (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:3001'))
  ).replace(/\/$/, '');

  if (!base) {
    return NextResponse.json({ error: 'Server API configuration incomplete' }, { status: 503 });
  }

  try {
    const res = await fetch(`${base}/health`, { cache: 'no-store' });
    const data = await res.json();
    return NextResponse.json(data, {
      status: res.status,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json({ status: 'unavailable', error: 'Backend unavailable' }, { status: 502 });
  }
}
