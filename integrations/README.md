# beehiiv, without publishing the key

The site is static. There is nowhere in it to keep a secret, and the beehiiv
API needs one. This Worker is the piece that holds it: the site posts to the
Worker, the Worker posts to beehiiv.

Nothing in this folder is secret. The key lives in Cloudflare, encrypted, and
is never committed.

---

## What you need first

From **beehiiv → Settings → API**:

- an **API key**
- the **publication ID** (starts with `pub_`)

---

## Deploy it

```bash
npm install -g wrangler
```

```bash
cd integrations && wrangler login
```

```bash
cd integrations && wrangler secret put BEEHIIV_API_KEY
```

Paste the key when prompted. Then the publication id:

```bash
cd integrations && wrangler secret put BEEHIIV_PUBLICATION_ID
```

```bash
cd integrations && wrangler deploy
```

Deploy prints a URL like `https://dossier-beehiiv.<your-subdomain>.workers.dev`.
**Send me that URL** and the site switches over in one line.

---

## The one line

In `assets/signup.js`:

```js
var DEFAULT_ENDPOINT = 'https://formspree.io/f/xjgnplqz';
```

becomes the Worker URL. Every capture point on the site reads that constant,
so all eight switch together. Nothing else changes: the on-file state, the
gate redirect, and the per-position tracking keep working.

---

## What the Worker does

Accepts exactly what the site already sends:

```json
{ "email": "…", "source": "dossier-home-top", "ref": "…" }
```

and calls `POST /v2/publications/{id}/subscriptions`, mapping the capture
point to `utm_campaign` so beehiiv shows which position on the site earns
signups, the way the Formspree source tag did.

Whether a new subscriber gets a confirmation email is **your beehiiv
setting**, not the Worker's. It does not override your double opt-in.

---

## What it does not do

**It is not spam-proof.** It requires the `Origin` header to match, which
stops another website from using it from a browser, but a script calling it
directly can set any header it likes. What actually protects the list is
beehiiv's own rate limiting and confirmation step.

`ALLOWED_ORIGIN` takes a comma-separated list, so a custom domain can be
added later without touching the Worker:

```
ALLOWED_ORIGIN = "https://tahayassine4-svg.github.io, https://thedossier.xyz"
```

To test against a local copy of the site, add `http://localhost:8642` to that
list, and take it out again afterwards.

If it ever gets abused, the cheap fix is a honeypot field in the forms — a
hidden input that a person never fills and a bot always does. Say the word.

---

## Cost

Cloudflare Workers' free tier is 100,000 requests a day. A signup is one
request. This will not cost anything.

---

## Moving the addresses you already have

Formspree submissions do not move themselves. Export the CSV from the
Formspree dashboard and import it into beehiiv once. Do that **before**
switching the endpoint, so nothing lands in the gap.
