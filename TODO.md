# TODO

Flame is an unfinished 2015 prototype. Nothing works end-to-end yet: the snippet can't load the script, and `/track` and `/trending` don't exist.

## Broken

### Server (`index.php`)
- [ ] `/script` reads `script.js` / `script.min.js` from the repo root, which don't exist (`index.php:21`).
- [ ] `/inline` reads `flame.inline.*.js` from the repo root, but it lives in `_flame/` (`index.php:33`).
- [x] The GeoIP block runs after the JS is echoed and appends plain text to the response, breaking the script (`index.php:75`).
- [x] `geoip_country_name_by_name()` needs the PECL `geoip` extension, which uses MaxMind's legacy databases (discontinued 2019). Fatal error if it isn't installed.
- [x] Client IP is trusted from `Client-IP` / `X-Forwarded-For`, which are spoofable, and XFF can be a comma-separated list (`index.php:67`). Removed with the GeoIP block.

### Snippets
- [ ] Three different script URLs across the snippets: `/api/code.js` (`index.html`), `/api/flame/script.js` (`_flame/flame.inline.js`), `empty.js` (`index.min.html`). There are no rewrite rules, so none reach `index.php`.
- [ ] Global name differs: `e['sher']` in the unminified snippets, `e['isher']` in the minified ones.

### Client scripts (`_flame/`)
- [ ] `flame.page.js:23` and `:35` call `getAttribute('content')` without assigning the result, so description and image are DOM elements, not strings.
- [x] `flame.language.js:2` falls back to `session.locale.lang`, but `window.session` is filled asynchronously and may not exist (ReferenceError).
- [x] `lib.session.js:23` enables `gapi_location` by default, which loads Google `jsapi` for the long-dead `google.loader.ClientLocation`. That's a wasted request on every pageview.
- [x] `lib.session.js:361` requests ipinfodb over `http://`, which is blocked as mixed content on HTTPS pages.

### Schema (`_sql/`)
- [ ] `Pageviews` and `Events` have no timestamp column, so trending over a time range can't be queried.
- [ ] `Events.id` defaults to `0` with no primary key or auto-increment.
- [ ] Tables are `latin1`. Switch to `utf8mb4` so non-Latin URLs, titles and search terms survive.
- [ ] `/trending` documents `title`, `image` and `description` in results, but no table stores them.

## To do

### Core
- [ ] Consume the `flame.q` command queue in the served script.
- [ ] Send collected data to the server (`navigator.sendBeacon` / `fetch`).
- [ ] Implement `PUT /track`.
- [ ] Look up location in `/track` with MaxMind GeoLite2. Only trust `X-Forwarded-For` from known proxies.
- [ ] Implement `GET /trending`, including the range limits in the README.
- [ ] Add database connection code (none exists).
- [ ] Settings (`index.php:45`).
- [ ] Apply the `?verbose` suffix to all `flame.*` scripts and add minified builds for them (`index.php:50`).
- [ ] HTTPS (`index.php:87`).
- [ ] Restore the redirect for unknown paths. It's commented out, so any URL serves the JS bundle.
- [ ] Honour Do Not Track. The `dnt-honor` setting exists, but nothing reads `navigator.doNotTrack`.

### Hygiene
- [ ] Wrap client code in an IIFE. It currently leaks `flame_*` globals and patches `HTMLElement.prototype` on host sites.
- [ ] Replace `getElementsByAttribute` with `querySelector('[attr="value"]')`.
- [ ] Add indexes on domain + time.
- [ ] Drop the Flash, Java, QuickTime and Silverlight columns. Detection went with session.js.
- [x] Delete `_flame/platform.js`, `_flame/session.js` and their `.min.js` copies. They are identical to the `lib.*` files, which are the only ones loaded.
- [ ] README links to `SETUP.md`, which doesn't exist.
- [ ] README "Results for Subscriptions" section is empty.
- [ ] Add a build step (e.g. terser) for `.min.js` files. They are currently committed by hand.

## Bundled libraries

- [x] **Platform.js** 1.3.0 → 1.3.6 (`_flame/lib.platform.js` + `.min.js`).
- [ ] User-agent strings are now frozen. Consider also reading `navigator.userAgentData` (User-Agent Client Hints).
- [x] **session.js** 0.4.1 is abandoned upstream. Replaced with `_flame/flame.session.js`, dropping its dead location and plugin detection.
- [x] Remove the PECL `geoip` lookup. The GeoLite2 replacement belongs in `/track`, which doesn't exist yet (see Core).
