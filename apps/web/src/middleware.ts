import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Routes that require authentication, by prefix
const PROTECTED_USER_ROUTES = ['/app'];
const PROTECTED_GYM_ROUTES = ['/gym'];
const PROTECTED_ADMIN_ROUTES = ['/admin'];

// Routes that should redirect mobile users to the PWA
const PWA_ROUTE_PREFIX = '/app';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ua = request.headers.get('user-agent') ?? '';
  const isMobile = /android|iphone|ipad|ipod|mobile/i.test(ua);

  // ── Desktop trying to access PWA → show "Open on mobile" page
  if (pathname.startsWith(PWA_ROUTE_PREFIX) && !isMobile) {
    return NextResponse.rewrite(new URL('/mobile-only', request.url));
  }

  // ── Set up Supabase client to read session from cookies
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            supabaseResponse = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
                supabaseResponse.cookies.set(name, value, options)
            );
        }
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // ── Unauthenticated access to protected routes
  const isProtectedUser = PROTECTED_USER_ROUTES.some(r => pathname.startsWith(r));
  const isProtectedGym = PROTECTED_GYM_ROUTES.some(r => pathname.startsWith(r));
  const isProtectedAdmin = PROTECTED_ADMIN_ROUTES.some(r => pathname.startsWith(r));

  if (!user) {
    if (isProtectedUser) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    if (isProtectedGym) {
      return NextResponse.redirect(new URL('/gym/login', request.url));
    }
    if (isProtectedAdmin) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    // Skip static assets and Next internals
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
