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

## Ideas

- [ ] Rate-limit `/track`, e.g. with Workers' Rate Limiting binding. The allowlist stops other sites' pages sending data, but not scripts that fake it.
- [ ] Cache `/trending` in the Worker with the Cache API, so pages don't each query the SQL API. Browsers already cache it for a minute.

## Done

- [x] Scaffolded the Worker in `server/` (`wrangler.jsonc`, `package.json`, `src/index.ts`). Unknown paths return a 404.
- [x] Updated Platform.js from 1.3.0 to 1.3.6.
- [x] Replaced session.js 0.4.1 with `client/flame.session.js`. This dropped its dead Google and ipinfodb location lookups and its plugin detection, and fixed the `session.locale.lang` fallback in `flame.language.js`.
- [x] `flame.timezone.js` no longer patches `Date.prototype`.
- [x] Removed the duplicate `platform.js` and `session.js` copies.
- [x] Removed the PECL `geoip` lookup, which broke the script response.
- [x] Fixed the README link to a `SETUP.md` that doesn't exist.
- [x] Renamed the snippet's global function from `extinguisher()` to `flame()`.
- [x] Snippets store the queue function's name in `window.flm`. It was `sher` in the unminified snippets and `isher` in the minified ones.
- [x] Dropped the Flash, Java, QuickTime and Silverlight columns from `Pageviews` and `Events`.
- [x] `flame.page.js` now stores the description and image `content` strings, not their DOM elements.
- [x] `flame.page.js` reads microdata on ordinary elements (text, `src` or `href`), and an empty title falls back to `document.title`.
- [x] `flame.page.js` tries each candidate until one has a value, only reads `name=` lookups from `<meta>` tags, and skips microdata on nested items such as an article's author.
- [x] `flame.page.js` prefers microdata on the page's main item (`Article`, `WebPage`, `Product`, `mainEntity`, etc.) and ignores site-wide items such as `Organization` and `WebSite`.
- [x] Removed `function.getElementsByAttribute.js`, which patched `HTMLElement.prototype`. `flame.page.js` uses `querySelectorAll` instead.
- [x] `npm run build` in `server/` bundles `client/flame.js` with esbuild into `dist/public/flame.js` and `flame.min.js`. The bundle adds no globals to host pages, and Platform.js no longer registers with AMD loaders like RequireJS. `lib.platform.min.js` is gone. `flame.inline.min.js` stays as the snippet to paste.
- [x] Client tests run in Vitest with jsdom (`client/test/`).
- [x] The Worker serves the client bundle at `/flame.js` from Workers Static Assets, minified unless `?verbose` is set. `wrangler dev` and `wrangler deploy` build it first. `/inline` is gone.
- [x] Deleted `index.php`. The Worker replaces it.
- [x] All four snippets load `https://flame.example.com/flame.js?v=1`, a placeholder for the Worker's hostname, and a test checks they agree.
- [x] The bundle runs the snippet's queued calls, then replaces `window[window.flm]` so later calls run straight away. It supports `setting` and `track`. Unknown commands and errors are logged, never thrown at the host page.
- [x] `flame('track', …)` sends everything collected to `/track` on the server the script came from, with `sendBeacon` (falling back to `fetch`). It's sent as `text/plain`, so there's no CORS preflight.
- [x] The client collects, stores and sends nothing when Global Privacy Control or Do Not Track is on, unless a site sets `honor-privacy-signals` to `false`. That setting replaces `dnt-honor`, and unknown settings are logged.
- [x] `flame('setting', 'session', false)` leaves out the session, so nothing is kept in localStorage. Sites can turn it back on once they have consent: in the EU, storing it generally needs consent, since analytics isn't strictly necessary. Phone/tablet detection moved to `flame.device.js`, so it still works without a session.
- [x] The browser's name and version come from User-Agent Client Hints where they're available, so Brave and Edge aren't reported as Chrome. Only the low-entropy brands are read. The OS still comes from Platform.js, since its version is a high-entropy hint.
- [x] The Analytics Engine data point layout is in `server/src/datapoint.ts` and documented in `sql/README.md`, replacing the MariaDB dumps (and with them, the settings table). The index is the page's domain. Long values are cut to a byte limit per field, so a data point always fits in 16 KB.
- [x] Country, region and city come from `request.cf`. No GeoIP database is needed, and IP addresses aren't stored.
- [x] Language falls back to the `Accept-Language` header when the client sends none.
- [x] `PUT` or `POST /track` stores one Analytics Engine data point per call and returns a 204. It rejects bodies that aren't JSON, are over 64 KB, or have no type or http(s) URL.
- [x] `/track` only stores data for pages on domains in `ALLOWED_DOMAINS` (a `wrangler.jsonc` var, with `*.` for subdomains), and rejects requests whose `Origin` isn't allowed. Nothing is allowed if it's empty.
- [x] `/track` stores nothing for requests with `Sec-GPC: 1` or `DNT: 1`, answering with a 204 as if it had.
- [x] `/track` and `/trending` answer CORS preflights and let pages on allowed sites read their responses. Other sites get no CORS headers.
- [x] `GET /trending` ranks pageviews, or sums payments and subscriptions by category, through the Analytics Engine SQL API. It applies the README's limits (28 days at most, and fewer results for longer ranges), counts with `_sample_interval`, and only answers for allowed domains. It needs `CF_ACCOUNT_ID` and a `CF_API_TOKEN` secret.
- [x] The `/trending` queries are `.sql` templates in `sql/`, which the Worker imports as text. Request values never go into them as they are: only checked types, integers and allowlisted hostnames, with categories compared as hex.
- [x] `/trending?format=xml` returns the same response as XML, errors included. Pages are `<result>` elements, and categories are `<category name="…">`.
- [x] `/trending?terms=["fire","hose"]` only ranks pages whose title or URL contains one of the words, ignoring case. Words can only have letters, numbers, spaces, hyphens and underscores, since they go into SQL.
- [x] `flame('trending', options, callback)` fetches `/trending` for the page's domain.
- [x] Each folder has a README: `client/` for the snippet, commands and what's collected, `server/` for setup, development and the API (including the `/track` payload and the results for subscriptions), and `sql/` for the layout and queries. The root README summarises and links to them.
- [x] CI builds, tests, type-checks and dry-run deploys on the current Node.js LTS, on every push to `main` and every pull request.
- [x] Dependabot updates GitHub Actions and npm daily, grouping minor and patch updates, and assigns lewisgoddard.
- [x] Node.js compatibility, on by default from the 2026-08-04 compatibility date, is turned off. Flame only uses web APIs.
