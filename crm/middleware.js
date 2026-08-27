import { NextResponse } from 'next/server';

export function middleware(req) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith('/d/') || pathname.startsWith('/api/details') ||
      pathname.startsWith('/api/shopify-webhook') ||
      pathname.startsWith('/api/stripe-webhook') || pathname.startsWith('/p/') ||
      pathname.startsWith('/api/inquiry') || pathname.startsWith('/api/visit') ||
      pathname.startsWith('/login') ||
      pathname.startsWith('/api/login') || pathname.startsWith('/fonts') ||
      pathname === '/') return NextResponse.next();
  const ok = req.cookies.get('cc_crm')?.value === process.env.CRM_ACCESS_CODE;
  if (!ok) return NextResponse.redirect(new URL('/login', req.url));
  return NextResponse.next();
}
export const config = { matcher: ['/((?!_next|favicon).*)'] };
