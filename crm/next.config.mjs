export default {
  reactStrictMode: true,
  outputFileTracingIncludes: { '/api/act/route': ['./assets/**'] },

  // /api/act settles invoices, voids them and records payments from ordinary form posts,
  // so the CRM must never be framable by a hostile page a signed-in rep happens to visit.
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      ],
    }];
  },
};
