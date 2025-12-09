import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    // Check for token in cookies or authorization header
    const token = request.cookies.get('accessToken')?.value ||
        request.headers.get('authorization')?.split(' ')[1];

    const isAuthPage = request.nextUrl.pathname.startsWith('/login') ||
        request.nextUrl.pathname.startsWith('/register');

    const isPublicPage = request.nextUrl.pathname === '/' || isAuthPage;

    // For protected routes, we'll let the client-side AuthContext handle the redirect
    // This is because tokens are stored in localStorage, not cookies
    // Middleware runs on the server and can't access localStorage

    // Only redirect authenticated users away from auth pages if we can detect the token
    if (token && isAuthPage) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
