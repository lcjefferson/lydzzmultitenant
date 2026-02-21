import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const pathname = request.nextUrl.pathname;

    // Raiz: sempre redirecionar para /login (evita 404; o AuthContext no client pode mandar para /dashboard se já logado)
    if (pathname === '/') {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    // Check for token in cookies or authorization header
    const token = request.cookies.get('accessToken')?.value ||
        request.headers.get('authorization')?.split(' ')[1];

    const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/register');

    // Only redirect authenticated users away from auth pages if we can detect the token
    if (token && isAuthPage) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
