import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from './auth';

const protectedRoutes = [
  '/dashboard',
  '/sessions',
  '/api/sessions',
  '/api/transcribe',
];

const authRoutes = [
  '/login',
  '/register',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionToken = request.cookies.get('better-auth.session_token')?.value;

  // Check if the route is protected
  const isProtectedRoute = protectedRoutes.some(route => 
    pathname.startsWith(route)
  );

  const isAuthRoute = authRoutes.some(route => 
    pathname.startsWith(route)
  );

  // Handle API routes
  if (pathname.startsWith('/api')) {
    // Allow auth-related API routes
    if (pathname.startsWith('/api/auth')) {
      return NextResponse.next();
    }

    // Check authentication for protected API routes
    if (isProtectedRoute) {
      if (!sessionToken) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }

      try {
        // Use Better Auth's getSession API
        const sessionData = await auth.api.getSession({
          headers: request.headers
        });
        
        if (!sessionData?.session || !sessionData?.user) {
          return NextResponse.json(
            { error: 'Invalid or expired session' },
            { status: 401 }
          );
        }

        // Add user to request headers for API routes
        const requestHeaders = new Headers(request.headers);
        requestHeaders.set('x-user-id', sessionData.user.id);
        requestHeaders.set('x-user-email', sessionData.user.email);
        if (sessionData.user.name) {
          requestHeaders.set('x-user-name', sessionData.user.name);
        }

        const response = NextResponse.next({
          request: {
            headers: requestHeaders,
          },
        });

        return response;
      } catch (error) {
        console.error('Session verification error:', error);
        // Session is invalid or expired
        const response = NextResponse.json(
          { error: 'Invalid or expired session' },
          { status: 401 }
        );
        
        // Clear invalid session cookie
        response.cookies.delete('better-auth.session_token');
        return response;
      }
    }
  }

  // Handle page routes
  if (isProtectedRoute) {
    if (!sessionToken) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Verify session for protected page routes
    try {
      const sessionData = await auth.api.getSession({
        headers: request.headers
      });
      
      if (!sessionData?.session || !sessionData?.user) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('callbackUrl', pathname);
        const response = NextResponse.redirect(loginUrl);
        response.cookies.delete('better-auth.session_token');
        return response;
      }
    } catch (error) {
      console.error('Session verification error:', error);
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete('better-auth.session_token');
      return response;
    }
  }

  if (isAuthRoute && sessionToken) {
    // Verify session before redirecting
    try {
      const sessionData = await auth.api.getSession({
        headers: request.headers
      });
      
      if (sessionData?.session && sessionData?.user) {
        // Redirect to dashboard if user is already authenticated
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    } catch (error) {
      // Session is invalid, allow access to auth routes
      const response = NextResponse.next();
      response.cookies.delete('better-auth.session_token');
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};