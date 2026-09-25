# TODO

Flame is an unfinished 2015 prototype, being rebuilt as three parts:

- `client/`: browser scripts and the embed snippet
- `server/`: a Cloudflare Worker in TypeScript
- `sql/`: the Analytics Engine queries behind `/trending`, and the layout of each data point

Pageviews and events are stored in Workers Analytics Engine. It keeps data for three months, samples at high volume, and holds up to 20 strings (blobs) and 20 numbers (doubles) per data point. Only allowlisted domains can send data or read trending. Settings are made on the client with `flame('setting', …)`, so there's no settings table.

Nothing works end-to-end yet: the Worker serves the client bundle, but `/track` and `/trending` aren't written.

## Server (`server/`)

- [x] Scaffold the Worker in `server/` (`wrangler.jsonc`, `package.json`, entry point).
- [x] Return a 404 for unknown paths.
- [ ] Implement `PUT /track`, writing one Analytics Engine data point per call.
- [ ] Only accept `/track` and `/trending` for domains in an allowlist (`ALLOWED_DOMAINS`).
- [ ] In `/track`, ignore requests that carry `Sec-GPC: 1` or `DNT: 1`. That also catches older client scripts.
- [ ] Take location from `request.cf` (country, region, city, timezone). No GeoIP database is needed, and IP addresses aren't stored.
- [ ] Fall back to the `Accept-Language` header when the client sends no language.
- [ ] Add CORS headers to `/track` and `/trending`, since other sites call them.
- [ ] Implement `GET /trending` through the Analytics Engine SQL API, including the range limits in the README.
- [ ] Support `format=xml` in `/trending`.
- [ ] Support `terms` in `/trending`.

## Analytics Engine (`sql/`)

- [ ] Replace the MariaDB dumps with the Analytics Engine data point layout: which blob and double holds each field, with the domain as the index (the sampling key). Timestamps are added automatically, and there are no row ids.
- [ ] Keep the `/trending` queries as `.sql` files the Worker loads.
- [ ] Never paste request values into SQL. The SQL API has no parameters and doesn't document string escaping.

## Client (`client/`)

- [ ] Snippets load from three different URLs: `/api/code.js` (`index.html`), `/api/flame/script.js` (`client/flame.inline.js`) and `empty.js` (`index.min.html`). Point them all at the Worker's bundle URL.
- [ ] Consume the command queue. The queue function's name is in `window.flm` (`flame` by default), and its calls are in `.q`.
- [ ] Send collected data to `/track` (`navigator.sendBeacon`, falling back to `fetch`).
- [ ] Honour privacy signals. If `navigator.globalPrivacyControl === true` or `navigator.doNotTrack === '1'`, collect and send nothing. The setting is `honor-privacy-signals` (default `true`), replacing `dnt-honor`.
- [ ] Let sites turn off the localStorage session ID with `flame('setting', 'session', false)`, e.g. until they have consent. In the EU, storing it generally needs consent, since analytics isn't strictly necessary. Privacy signals don't cover that.
- [ ] User-agent strings are now frozen. Also read `navigator.userAgentData` (User-Agent Client Hints) where it's available.

## Docs

- [ ] README "Results for Subscriptions" section is empty.
- [ ] Document the `/track` payload, settings, and how to configure and deploy the Worker.

## Done

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
