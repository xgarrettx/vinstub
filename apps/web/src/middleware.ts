import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const REFRESH_COOKIE = 'vs_refresh';

// Routes that require authentication
const PROTECTED = ['/dashboard', '/account'];
// Routes only for unauthenticated users
const AUTH_ROUTES = ['/login', '/register', '/forgot-password', '/reset-password'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasRefreshToken = request.cookies.has(REFRESH_COOKIE);

  // If accessing protected route without a refresh token → redirect to login
  if (PROTECTED.some((p) => pathname.startsWith(p)) && !hasRefreshToken) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('from', pathname);
    return NextResponse.redirect(url);
  }

  // If already has a refresh token and trying to access auth routes → redirect to dashboard
  if (AUTH_ROUTES.some((p) => pathname.startsWith(p)) && hasRefreshToken) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/).*)',
  ],
};
