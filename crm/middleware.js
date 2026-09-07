import { NextResponse } from 'next/server';
import { clerkMiddleware } from '@clerk/nextjs/server';

// Public: collector-facing pages, the capture endpoints the live site posts to, and the
// health check an uptime monitor watches.
const isPublic = (p) =>
  p.startsWith('/d/') || p.startsWith('/o/') || p.startsWith('/p/') ||
  p.startsWith('/api/details') || p.startsWith('/api/offer') ||
  p.startsWith('/api/inquiry') || p.startsWith('/api/visit') ||
  p.startsWith('/api/health') ||
  p.startsWith('/api/shopify-webhook') || p.startsWith('/api/stripe-webhook') ||
  p.startsWith('/api/docusign-webhook') || p.startsWith('/api/cron/') ||
  p.startsWith('/login') || p.startsWith('/api/login') ||
  p.startsWith('/sign-in') || p.startsWith('/sign-up') || p.startsWith('/fonts') ||
  p === '/';

const clerkOn = !!process.env.CLERK_SECRET_KEY && !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

// While Clerk is being switched on, the shared code still works. It gets someone in, but
// it never establishes identity — so pay stays private and actions log as unattributed.
const sharedCodeOk = (req) =>
  req.cookies.get('cc_crm')?.value === process.env.CRM_ACCESS_CODE;

const legacy = (req) => {
  if (isPublic(req.nextUrl.pathname)) return NextResponse.next();
  if (sharedCodeOk(req)) return NextResponse.next();
  return NextResponse.redirect(new URL('/login', req.url));
};

const withClerk = clerkMiddleware(async (auth, req) => {
  if (isPublic(req.nextUrl.pathname)) return NextResponse.next();
  const { userId } = await auth();
  if (userId) return NextResponse.next();
  if (sharedCodeOk(req)) return NextResponse.next();      // transition fallback
  return NextResponse.redirect(new URL('/sign-in', req.url));
});

export default function middleware(req, ev) {
  return clerkOn ? withClerk(req, ev) : legacy(req);
}

export const config = {
  matcher: [
    '/((?!_next|favicon).*)',
    '/(api|trpc)(.*)',
    '/__clerk/:path*',
  ],
};
