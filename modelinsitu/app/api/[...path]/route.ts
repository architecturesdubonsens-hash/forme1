import { NextRequest, NextResponse } from 'next/server';

const BACKEND = process.env.BACKEND_URL
  || 'https://modelinsitu-backend-production-95b3.up.railway.app';

async function handler(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const url = `${BACKEND}/${path.join('/')}${req.nextUrl.search}`;

  const init: RequestInit = { method: req.method };
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = await req.text();
    init.headers = { 'Content-Type': 'application/json' };
  }

  try {
    const res = await fetch(url, init);
    const body = await res.text();
    return new NextResponse(body, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('content-type') || 'application/json' },
    });
  } catch {
    return NextResponse.json({ error: 'Backend inaccessible' }, { status: 503 });
  }
}

export { handler as GET, handler as POST, handler as PUT, handler as DELETE, handler as PATCH };
