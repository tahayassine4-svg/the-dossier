/**
 * THE DOSSIER // beehiiv proxy
 *
 * A Cloudflare Worker that stands between the site and the beehiiv API.
 * The site is static, so it has nowhere to keep a secret: this Worker holds
 * the API key and is the only thing that ever sees it.
 *
 * It accepts exactly what assets/signup.js already sends:
 *     POST { "email": "...", "source": "dossier-home-top", "ref": "..." }
 *
 * NOTHING SECRET BELONGS IN THIS FILE. The key and publication id are read
 * from the Worker's environment, set with `wrangler secret put`. This file
 * lives in a public repo; the secrets do not.
 *
 * Environment:
 *   BEEHIIV_API_KEY         secret, from beehiiv Settings > API
 *   BEEHIIV_PUBLICATION_ID  secret, the pub_... id of the publication
 *   ALLOWED_ORIGIN          plain var, e.g. https://tahayassine4-svg.github.io
 */

const API = 'https://api.beehiiv.com/v2';

// ALLOWED_ORIGIN may hold several origins, comma separated, so a custom
// domain can be added later without touching this file.
function allowList(env) {
  return String(env.ALLOWED_ORIGIN || '')
    .split(',').map(s => s.trim()).filter(Boolean);
}

function cors(origin, list) {
  // Echo the origin only when it matches, so a browser on any other site is
  // refused by its own CORS check rather than being quietly served.
  const ok = list.includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin : (list[0] || ''),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers }
  });
}

// Deliberately loose. Real validation is beehiiv confirming the address;
// this only rejects obvious rubbish before spending a request on it.
function looksLikeEmail(v) {
  return typeof v === 'string' &&
         v.length > 3 && v.length < 320 &&
         /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const list = allowList(env);
    const head = cors(origin, list);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: head });
    }
    if (request.method !== 'POST') {
      return json({ ok: false, error: 'method not allowed' }, 405, head);
    }
    // The Worker is a different origin from the site, so a browser always
    // sends Origin on a real signup. A request without one is therefore not
    // the site, and is refused rather than waved through.
    if (list.length && !list.includes(origin)) {
      return json({ ok: false, error: 'origin not allowed' }, 403, head);
    }
    if (!env.BEEHIIV_API_KEY || !env.BEEHIIV_PUBLICATION_ID) {
      return json({ ok: false, error: 'not configured' }, 500, head);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: 'bad json' }, 400, head);
    }

    const email = (body.email || '').trim();
    if (!looksLikeEmail(email)) {
      return json({ ok: false, error: 'invalid email' }, 400, head);
    }

    // The capture point rides along as the campaign, so beehiiv shows which
    // position on the site actually earns signups, the way the Formspree
    // source tag did.
    const source = String(body.source || 'dossier').slice(0, 120);
    const ref = String(body.ref || '').slice(0, 500);

    let res;
    try {
      res = await fetch(`${API}/publications/${env.BEEHIIV_PUBLICATION_ID}/subscriptions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.BEEHIIV_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          reactivate_existing: false,
          send_welcome_email: true,
          utm_source: 'the-dossier',
          utm_medium: 'website',
          utm_campaign: source,
          referring_site: ref || undefined
        })
      });
    } catch {
      return json({ ok: false, error: 'upstream unreachable' }, 502, head);
    }

    if (res.ok) {
      // The subscriber object is not the site's business, so it is not
      // returned. Confirmation vs double opt-in is beehiiv's setting.
      return json({ ok: true }, 200, head);
    }

    // Upstream detail is logged for the tail, never handed to the page: it
    // can carry account information the reader has no business seeing.
    let detail = '';
    try { detail = (await res.text()).slice(0, 500); } catch {}
    console.log('beehiiv rejected', res.status, detail);

    if (res.status === 429) {
      return json({ ok: false, error: 'rate limited' }, 429, head);
    }
    if (res.status === 401 || res.status === 404) {
      // Misconfiguration on our side, not the reader's fault.
      return json({ ok: false, error: 'not configured' }, 500, head);
    }
    return json({ ok: false, error: 'rejected' }, 400, head);
  }
};
