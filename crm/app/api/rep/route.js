import { isStaff } from '../../../lib/identity';
export async function POST(req) {
  // Signed in is not the same as staff — this endpoint returns real collector
  // and inventory data, so it must never answer a stranger's account.
  if (!(await isStaff())) return new Response('Not authorised', { status: 403 });

  const form = await req.formData();
  const rep = (form.get('rep') || '').toString().slice(0, 40);
  return new Response(null, { status: 302, headers: {
    Location: req.headers.get('referer') || '/today',
    'Set-Cookie': `cc_rep=${encodeURIComponent(rep)}; Path=/; Max-Age=31536000; SameSite=Lax`,
  }});
}
