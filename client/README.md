# Client

The browser script that collects data about a page and sends it to the Worker, and the snippet that loads it. esbuild bundles [`flame.js`](flame.js) and everything it imports into one script, which the [Worker](../server/README.md) serves at `/flame.js`.

## The snippet

The snippet loads `/flame.js` asynchronously and queues any `flame(…)` calls until it arrives, so it can go anywhere on the page. It adds two globals: `flame`, the function, and `flm`, the function's name. To use another name, change the snippet's last argument.

```js
flame('setting', 'session', false);
flame('track', 'pageview');
flame('track', 'payment', 1200, 'Linux');
flame('trending', { range: 7200 }, function(Trending) {
	console.log(Trending.results);
});
```

Paste [`flame.inline.js`](flame.inline.js), or its minified copy [`flame.inline.min.js`](flame.inline.min.js), into each page, replacing `flame.example.com` with the Worker's hostname. Change its `?v=1` to make browsers fetch a new copy of the script sooner than their hour-long cache would.

## Commands

### flame('track', type, data, category)

Sends one pageview or event to `/track`, along with everything [collected](#whats-collected) about the page.

| Argument | Default | Description |
|---|---|---|
| type | `pageview` | `pageview`, `payment`, `subscription`, or a type of your own, such as `event`. |
| data | The page's URL, for pageviews | What's being tracked. Pageviews default to the page's URL without its fragment. For payments and subscriptions, it's the amount, as an integer (e.g. pence) rather than a float. |
| category | _none_ | A category to group data by. |

A page only counts as one pageview in its visitor's session, however many times it calls `track`.

### flame('setting', name, value)

| Setting | Default | Description |
|---|---|---|
| `honor-privacy-signals` | `true` | Collect, store and send nothing when the browser has [Global Privacy Control](https://globalprivacycontrol.org/) or Do Not Track turned on. |
| `session` | `true` | Keep a session ID, visit count and search referrer in localStorage. |

In the EU, storing the session in localStorage generally needs the visitor's consent, since analytics isn't strictly necessary. Privacy signals don't cover that. Until you have consent, set `session` to `false`, then set it back to `true` once you do.

Settings apply to calls made after them, so put them first.

### flame('trending', options, callback)

Fetches [`/trending`](../server/README.md#get-trending) for the page's domain, and passes the parsed response to the callback. Options are `/trending`'s parameters, apart from `format`, with `terms` as a list of words. If the request fails, the callback gets `{ success: false, warning: false, error: '…' }`.

```js
flame('trending', { type: 'pageview', count: 5, range: 86400, terms: ['fire', 'hose'] }, function(Trending) {
	Trending.results.forEach(function(Page) {
		console.log(Page.title, Page.url, Page.count);
	});
});
```

## What's collected

| Data | From |
|---|---|
| Browser, version, rendering engine, and operating system | [Platform.js](https://github.com/bestiejs/platform.js) (`lib.platform.js`), with the browser's name and version from User-Agent Client Hints where the browser has them (`flame.hints.js`) |
| Session ID, visits in the last 32 days, pageviews this visit, new visitor, search engine and query | `flame.session.js`. A session ends after 30 minutes without a pageview. |
| Phone or tablet | `flame.device.js` |
| Page title, description and image | `flame.page.js`, from Open Graph, microdata and Twitter tags |
| Screen size, colour depth and orientation, and viewport size | `flame.display.js` |
| Language | `flame.language.js`, or the `Accept-Language` header |
| Timezone offset and daylight saving time | `flame.timezone.js` |
| Processor cores | `flame.processor.js` |
| Page URL and referrer | `location` and `document.referrer` |
| Country, region and city | Cloudflare, in the Worker (`request.cf`). IP addresses aren't stored. |

[`sql/README.md`](../sql/README.md) lists where each one is stored.

## Files

| File | Contents |
|---|---|
| `flame.js` | The entry point. It runs the snippet's queue and each command, and sends data. |
| `flame.inline.js`, `flame.inline.min.js` | The snippet. |
| `flame.*.js` | One collector each, listed above. |
| `lib.platform.js` | [Platform.js](https://github.com/bestiejs/platform.js) 1.3.6, unmodified. |
| `test/` | Tests, run in Vitest with jsdom. |

## Building and testing

The tooling lives in [`server/`](../server/README.md), so run these from there.

- `npm run build` bundles the client into `server/dist/public/flame.js` and a minified `flame.min.js`. The bundle is wrapped in a function, so it adds nothing to the page, and `define` is compiled out so Platform.js can't register with an AMD loader like RequireJS.
- `npm test` builds the client, then runs its tests alongside the Worker's. The client has no `package.json`, so its tests use Vitest's globals rather than importing from `vitest`. The bundle and snippet tests run the built files, as a browser would.
