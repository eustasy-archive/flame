# TODO

Flame is a 2015 prototype, rebuilt as three parts:

- `client/`: browser scripts and the embed snippet
- `server/`: a Cloudflare Worker in TypeScript
- `sql/`: the Analytics Engine queries behind `/trending`, and the layout of each data point

Pageviews and events are stored in Workers Analytics Engine. It keeps data for three months, samples at high volume, and holds up to 20 strings (blobs) and 20 numbers (doubles) per data point. Only allowlisted domains can send data or read trending. Settings are made on the client with `flame('setting', …)`, so there's no settings table.

Everything planned is written and tested locally, but it hasn't run against a real Analytics Engine dataset yet.

## Before it's used

- [ ] Deploy it, and check `/trending`'s queries against a real dataset. They've only been tested against a stand-in for the SQL API, so the details taken from Cloudflare's docs haven't been checked: `argMax(…, timestamp)`, `lower(hex(…))`, `position(… IN lowerUTF8(…))`, and counts arriving as strings.
- [ ] Replace `flame.example.com` in the snippets with the Worker's hostname, and set `ALLOWED_DOMAINS` and `CF_ACCOUNT_ID` in `wrangler.jsonc`.
- [ ] Consider an account-owned API token for `CF_API_TOKEN`, if Cloudflare counts those separately from a user's rate limit. The docs don't say.

## Waiting on others

- [ ] Remove the Vitest major-version `ignore` from `.github/dependabot.yml` once `@cloudflare/vitest-plugin` supports Vitest 5. Its peer range is `^4.1.0` as of 1.2.8, so Dependabot's Vitest 5 update ([#1](https://github.com/eustasy-archive/flame/pull/1)) can't install.

## Ideas

- [ ] Try [Workers Cache](https://developers.cloudflare.com/workers/cache/) for `/trending` instead of the Cache API. It works on `workers.dev`, is shared across data centers, and collapses simultaneous requests into one. It sits in front of the Worker, though, so first check it keeps responses for different `Origin`s apart (`Vary: Origin`). Otherwise one site's CORS headers could be served to another.

- [ ] Rate-limit `/track`, e.g. with Workers' Rate Limiting binding. The allowlist stops other sites' pages sending data, but not scripts that fake it.
