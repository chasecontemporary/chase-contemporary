import './globals.css';
import localFont from 'next/font/local';

// The gallery's own face, inside the tool — same family the collectors see.
const nimbus = localFont({
  src: [
    { path: '../assets/fonts/nimbus-sans-novus-regular.ttf', weight: '400' },
    { path: '../assets/fonts/nimbus-sans-novus-medium.ttf', weight: '500' },
    { path: '../assets/fonts/nimbus-sans-novus-semibold.ttf', weight: '600' },
    { path: '../assets/fonts/nimbus-sans-novus-semibold.ttf', weight: '650' },
    { path: '../assets/fonts/nimbus-sans-novus-semibold.ttf', weight: '700' },
  ],
  fallback: ['Helvetica Neue', 'Helvetica', 'Arial', 'sans-serif'],
});

export const metadata = { title: 'Chase Contemporary · Engine' };

const clerkOn = !!process.env.CLERK_SECRET_KEY && !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export default async function RootLayout({ children }) {
  const page = <html lang="en"><body className={nimbus.className}>{children}</body></html>;
  if (!clerkOn) return page;                       // no keys yet: run exactly as before
  const { ClerkProvider } = await import('@clerk/nextjs');
  return <ClerkProvider>{page}</ClerkProvider>;
}
