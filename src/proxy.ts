import { NextRequest, NextResponse } from 'next/server';

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes - no auth needed
  if (pathname.startsWith('/login') || pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  // Cron routes - verify CRON_SECRET instead of session
  if (pathname.startsWith('/api/cron')) {
    const cronSecret = request.headers.get('authorization');
    if (cronSecret !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json(
        { data: null, error: { message: 'Unauthorized', code: 'INVALID_CRON_SECRET' } },
        { status: 401 }
      );
    }
    return NextResponse.next();
  }

  // All other routes - check session cookie
  const session = request.cookies.get('session');
  if (!session?.value) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
