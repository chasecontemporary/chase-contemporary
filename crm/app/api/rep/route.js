export async function POST(req) {
  const form = await req.formData();
  const rep = (form.get('rep') || '').toString().slice(0, 40);
  return new Response(null, { status: 302, headers: {
    Location: req.headers.get('referer') || '/today',
    'Set-Cookie': `cc_rep=${encodeURIComponent(rep)}; Path=/; Max-Age=31536000; SameSite=Lax`,
  }});
}
