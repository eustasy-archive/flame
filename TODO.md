# TODO

Flame is an unfinished 2015 prototype, being rebuilt as three parts:

- `client/`: browser scripts and the embed snippet
- `server/`: a Cloudflare Worker, replacing `index.php`
- `sql/`: the database schema

Nothing works end-to-end yet. The Worker doesn't exist, and `/track` and `/trending` were never written.

## Server (`server/`)

The Worker replaces `index.php`. Don't fix the PHP: it still loads from `_flame/`, so it stopped working when the files moved.

- [ ] Scaffold the Worker in `server/` (`wrangler.jsonc`, `package.json`, entry point).
- [ ] Serve the client bundle at one stable URL. Build it from `client/` at deploy time instead of joining files on every request. `?verbose` serves the unminified build.
- [ ] Decide whether `/inline` is still needed. The snippet is meant to be pasted into pages, not fetched.
- [ ] Implement `PUT /track`.
- [ ] Implement `GET /trending`, including the range limits in the README.
- [ ] Take location from `request.cf` (country, region, city). No GeoIP database is needed. If the client IP is needed at all, use `CF-Connecting-IP`.
- [ ] Fall back to the `Accept-Language` header when the client sends no language.
- [ ] Add CORS headers to `/track` and `/trending`, since other sites call them.
- [ ] Return a 404 (or redirect to extinguisher.io) for unknown paths.
- [ ] Settings (the `// TODO Settings` in `index.php`).
- [ ] Delete `index.php` once the Worker serves the bundle.

## Database (`sql/`)

- [ ] Convert the MariaDB dumps to D1 (SQLite) migrations. They use MySQL-only syntax (`ENGINE=InnoDB`, `AUTO_INCREMENT`, `int(11)`, `/*!40101 … */`). This also fixes the `latin1` tables, since SQLite stores text as UTF-8.
- [ ] Decide whether raw pageviews and events go in D1 or in Workers Analytics Engine, which is built for high-volume event data.
- [ ] Add a timestamp column to `Pageviews` and `Events`. Without one, trending over a time range can't be queried.
- [ ] Give `Events.id` a primary key. It currently defaults to `0` and never increments.
- [ ] Add location columns (country, region, city) for the `request.cf` data.
- [ ] Store `title`, `image` and `description`, which `/trending` documents but no table holds.
- [ ] Add indexes on domain + time.

## Client (`client/`)

### Broken
- [ ] Snippets load from three different URLs: `/api/code.js` (`index.html`), `/api/flame/script.js` (`client/flame.inline.js`) and `empty.js` (`index.min.html`). Point them all at the Worker's bundle URL.

### To do
- [ ] Consume the command queue. The queue function's name is in `window.flm` (`flame` by default), and its calls are in `.q`.
- [ ] Send collected data to `/track` (`navigator.sendBeacon` / `fetch`).
- [ ] Honour Do Not Track. The `dnt-honor` setting exists, but nothing reads `navigator.doNotTrack`.
- [ ] Add a build step (e.g. esbuild) that bundles and minifies `client/`, replacing the hand-committed `.min.js` files.
- [ ] Wrap client code in an IIFE. It currently leaks `flame_*` globals and patches `HTMLElement.prototype` on host sites.
- [ ] Replace `getElementsByAttribute` with `querySelector('[attr="value"]')`.
- [ ] User-agent strings are now frozen. Consider also reading `navigator.userAgentData` (User-Agent Client Hints).

## Docs

- [ ] README "Results for Subscriptions" section is empty.

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
