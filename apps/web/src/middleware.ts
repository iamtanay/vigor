import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Routes that require authentication
const PROTECTED_USER_ROUTES  = ['/app'];
const PROTECTED_GYM_ROUTES   = ['/gym'];
const PROTECTED_ADMIN_ROUTES = ['/admin'];

// Login pages — never redirect these, even when unauthenticated
const AUTH_PAGES = ['/login', '/gym/login', '/admin/login', '/auth/callback'];

// Desktop trying to access the user PWA → show "open on mobile" page
const PWA_ROUTE_PREFIX = '/app';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Skip auth pages entirely (no Supabase call needed)
  if (AUTH_PAGES.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const ua = request.headers.get('user-agent') ?? '';
  const isMobile = /android|iphone|ipad|ipod|mobile/i.test(ua);

  // ── Desktop trying to reach PWA
  if (pathname.startsWith(PWA_ROUTE_PREFIX) && !isMobile) {
    return NextResponse.rewrite(new URL('/mobile-only', request.url));
  }

  const isProtectedUser  = PROTECTED_USER_ROUTES.some(r => pathname.startsWith(r));
  const isProtectedGym   = PROTECTED_GYM_ROUTES.some(r => pathname.startsWith(r));
  const isProtectedAdmin = PROTECTED_ADMIN_ROUTES.some(r => pathname.startsWith(r));

  // ── Only hit Supabase for protected routes
  if (!isProtectedUser && !isProtectedGym && !isProtectedAdmin) {
    return NextResponse.next();
  }

  // ── Guard: if Supabase env vars aren't set yet, skip auth check
  // (prevents crash during initial dev setup before .env.local exists)
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.warn('[middleware] Supabase env vars not set — skipping auth check');
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    if (isProtectedUser)  return NextResponse.redirect(new URL('/login',       request.url));
    if (isProtectedGym)   return NextResponse.redirect(new URL('/gym/login',   request.url));
    if (isProtectedAdmin) return NextResponse.redirect(new URL('/admin/login', request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    // Skip all static assets and Next internals
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|json)$).*)',
  ],
};
