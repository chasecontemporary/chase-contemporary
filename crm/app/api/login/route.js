export async function POST(req) {
  const form = await req.formData();
  const code = form.get('code');
  if (code === process.env.CRM_ACCESS_CODE) {
    return new Response(null, { status: 302, headers: {
      'Location': '/today',
      'Set-Cookie': `cc_crm=${code}; Path=/; HttpOnly; Secure; Max-Age=2592000; SameSite=Lax`,
    }});
  }
  return new Response(null, { status: 302, headers: { 'Location': '/login' } });
}
