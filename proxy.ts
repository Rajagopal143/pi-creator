import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const AUTH_COOKIE = 'yakuza_auth';
const AUTH_TOKEN  = 'yakuza_session_v1';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow login page and auth API routes through unconditionally
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth')
  ) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get(AUTH_COOKIE);
  if (!cookie || cookie.value !== AUTH_TOKEN) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.svg|.*\\.png|.*\\.jpg).*)',
  ],
};
