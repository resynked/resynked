import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

/** Pagina's die je zonder account moet kunnen openen. */
const LOGGED_OUT_ONLY = ['/login', '/register', '/forgot-password'];

/** Waar je na het inloggen terechtkomt */
const DASHBOARD = '/app/dashboard';

/**
 * De app staat onder /app en vraagt om inloggen; de website (alles daarbuiten)
 * is voor iedereen open.
 *
 * Wie niet ingelogd is gaat al op de server naar de inlogpagina. Anders laadt
 * eerst het dashboard met zijn skeletons, en springt het pas daarna om zodra
 * de browser doorheeft dat er geen sessie is.
 */
export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const inApp = pathname === '/app' || pathname.startsWith('/app/');

  // De website hoeft niet te weten wie je bent; dat scheelt bij elk bezoek
  if (!inApp && !LOGGED_OUT_ONLY.includes(pathname)) return NextResponse.next();

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (!inApp) {
    // Al ingelogd: dan heeft de inlogpagina geen zin meer
    return token ? NextResponse.redirect(new URL(DASHBOARD, req.url)) : NextResponse.next();
  }

  if (token) {
    // Alleen /app heeft geen pagina; dan naar het dashboard
    return pathname === '/app' ? NextResponse.redirect(new URL(DASHBOARD, req.url)) : NextResponse.next();
  }

  // Na het inloggen terug naar de pagina waar je heen wilde
  const login = new URL('/login', req.url);
  if (pathname !== DASHBOARD && pathname !== '/app') login.searchParams.set('callbackUrl', pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  // Alleen de app en de inlogpagina's; de API controleert zelf, en de website,
  // de pagina's van de klant (/public/...) en losse bestanden hebben niemand nodig
  matcher: ['/app/:path*', '/app', '/login', '/register', '/forgot-password'],
};
