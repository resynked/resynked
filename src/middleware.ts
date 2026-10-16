import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

/** Pagina's die je zonder account moet kunnen openen. */
const ZONDER_ACCOUNT = ['/login', '/register', '/forgot-password'];

/**
 * Altijd open, ingelogd of niet: de website (de homepage, een demo aanvragen,
 * privacy en voorwaarden) en de link uit de herstelmail
 */
const ALTIJD_OPEN = ['/', '/demo', '/privacy', '/voorwaarden', '/reset-password'];

/** Waar je na het inloggen terechtkomt */
const DASHBOARD = '/dashboard';

/**
 * Wie niet ingelogd is gaat al op de server naar de inlogpagina. Anders laadt
 * eerst het dashboard met zijn skeletons, en springt het pas daarna om zodra
 * de browser doorheeft dat er geen sessie is.
 */
export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // De website hoeft niet te weten wie je bent; dat scheelt bij elk bezoek
  if (ALTIJD_OPEN.includes(pathname)) return NextResponse.next();

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (ZONDER_ACCOUNT.includes(pathname)) {
    // Al ingelogd: dan heeft de inlogpagina geen zin meer
    return token ? NextResponse.redirect(new URL(DASHBOARD, req.url)) : NextResponse.next();
  }

  if (token) return NextResponse.next();

  // Na het inloggen terug naar de pagina waar je heen wilde
  const login = new URL('/login', req.url);
  if (pathname !== DASHBOARD) login.searchParams.set('callbackUrl', pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  // Niet voor de API (die controleert zelf), de bestanden van Next.js, losse
  // bestanden zoals het logo, en de offerte- en factuurpagina die de klant via
  // zijn link opent
  matcher: ['/((?!api|_next|offerte/|factuur/|.*\\..*).*)'],
};
