import { rateLimit } from '../../../lib/ratelimit';

// The shared access code. It guards 27,000 collector records and, until Clerk fully takes
// over, it is the whole lock — so guessing has to be expensive. Ten attempts per quarter
// hour per address is far more than a person mistyping and far less than a script needs.
export async function POST(req) {
  const form = await req.formData();
  const code = form.get('code');

  const { ok } = await rateLimit(req, 'login', 10, 900);
  if (!ok) return new Response(null, { status: 302, headers: { Location: '/login?e=slow' } });

  if (code === process.env.CRM_ACCESS_CODE) {
    return new Response(null, { status: 302, headers: {
      'Location': '/today',
      'Set-Cookie': `cc_crm=${code}; Path=/; HttpOnly; Secure; Max-Age=2592000; SameSite=Lax`,
    }});
  }
  return new Response(null, { status: 302, headers: { Location: '/login?e=1' } });
}
