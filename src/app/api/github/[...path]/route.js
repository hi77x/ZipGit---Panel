// Same-origin proxy to api.github.com.
// The user's PAT stays in the browser and is forwarded per-request via Authorization;
// the server adds nothing of its own (no shared token, no telemetry).
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function proxy(req, { params }) {
  const path = '/' + (params.path || []).join('/');
  const inbound = new URL(req.url);
  const target = 'https://api.github.com' + path + inbound.search;

  const headers = new Headers();
  const auth = req.headers.get('authorization');
  if (auth) headers.set('authorization', auth);
  headers.set('accept', req.headers.get('accept') || 'application/vnd.github+json');
  headers.set('x-github-api-version', '2022-11-28');
  headers.set('user-agent', 'ziptogit-next-proxy');
  const ct = req.headers.get('content-type');
  if (ct) headers.set('content-type', ct);

  const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.text();

  let res;
  try {
    res = await fetch(target, { method: req.method, headers, body });
  } catch (e) {
    return Response.json({ message: 'proxy network error: ' + String(e?.message || e) }, { status: 502 });
  }

  const buf = await res.arrayBuffer();
  const out = new Headers();
  for (const k of ['content-type', 'x-oauth-scopes', 'x-ratelimit-remaining', 'x-ratelimit-limit', 'retry-after']) {
    const v = res.headers.get(k);
    if (v) out.set(k, v);
  }
  out.set('access-control-expose-headers', 'x-oauth-scopes, x-ratelimit-remaining');
  return new Response(buf, { status: res.status, headers: out });
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE };
