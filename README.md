# Flame

Pageview and event tracking for your own sites, with an API for their trending pages. It runs as a Cloudflare Worker and stores data in Workers Analytics Engine. Still unfinished: see [TODO.md](TODO.md).

| Folder | Contents |
|---|---|
| `client/` | The browser script that collects pageview data, and the embed snippet (`flame.inline.js`). |
| `server/` | The Cloudflare Worker, in TypeScript. It serves the client, and handles `/track` and `/trending`. |
| `sql/` | The Analytics Engine queries behind `/trending`, and the [layout of each data point](sql/README.md). |

`index.html` and `index.min.html` are example embeds of the snippet.

## Set up

Everything runs from `server/`, which has the tooling for both the Worker and the client.

1. **Install and test.** `npm install`, then `npm test`. The tests build the client first.
2. **Configure `server/wrangler.jsonc`.**
   - `ALLOWED_DOMAINS`: the sites that may send data and read trending, separated by commas. `*.example.com` matches any subdomain of example.com, but not example.com itself. Nothing is allowed if it's empty.
   - `CF_ACCOUNT_ID`: your Cloudflare account ID, which `/trending` needs to query Analytics Engine.
   - `ANALYTICS_DATASET`: the dataset's name, which must match `dataset` under `analytics_engine_datasets`. It's `flame` unless you change both.
3. **Add an API token for `/trending`.** Create a Cloudflare API token with *Account Analytics: Read*, then run `npx wrangler secret put CF_API_TOKEN`. For `npm run dev`, copy `.dev.vars.example` to `.dev.vars` and put it there.
4. **Deploy.** `npx wrangler deploy` builds the client and deploys the Worker. Analytics Engine creates the dataset when the first data point is written.
5. **Embed the snippet** from [`client/flame.inline.js`](client/flame.inline.js), or its minified copy, on each page. Replace `flame.example.com` with your Worker's hostname, then add your `flame(…)` calls after it.

`npm run dev` runs the Worker locally. Data written there goes nowhere, but `/trending` queries the real Analytics Engine if it's configured.

## Using it on a page

The snippet loads `/flame.js` asynchronously and queues any `flame(…)` calls until it arrives, so it can go anywhere on the page. It adds two globals: `flame`, the function, and `flm`, the function's name. To use another name, change the snippet's last argument.

```js
flame('setting', 'session', false);
flame('track', 'pageview');
flame('track', 'payment', 1200, 'Linux');
flame('trending', { range: 7200 }, function(Trending) {
	console.log(Trending.results);
});
```

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

Fetches [`/trending`](#get-trending) for the page's domain, and passes the parsed response to the callback. Options are `/trending`'s parameters, apart from `format`, with `terms` as a list of words. If the request fails, the callback gets `{ success: false, warning: false, error: '…' }`.

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
| Browser, version, rendering engine, and operating system | [Platform.js](https://github.com/bestiejs/platform.js) (`client/lib.platform.js`), with the browser's name and version from User-Agent Client Hints where the browser has them (`client/flame.hints.js`) |
| Session ID, visits in the last 32 days, pageviews this visit, new visitor, search engine and query | `client/flame.session.js`. A session ends after 30 minutes without a pageview. |
| Phone or tablet | `client/flame.device.js` |
| Page title, description and image | `client/flame.page.js`, from Open Graph, microdata and Twitter tags |
| Screen size, colour depth and orientation, and viewport size | `client/flame.display.js` |
| Language | `client/flame.language.js`, or the `Accept-Language` header |
| Timezone offset and daylight saving time | `client/flame.timezone.js` |
| Processor cores | `client/flame.processor.js` |
| Page URL and referrer | `location` and `document.referrer` |
| Country, region and city | Cloudflare, in the Worker (`request.cf`). IP addresses aren't stored. |

[`sql/README.md`](sql/README.md) lists where each one is stored.

## API

### GET /flame.js

The client, minified. Add `?verbose` for a readable copy. It's cached for an hour; change the snippet's `?v=1` to fetch a new copy sooner.

### PUT or POST /track

Stores one pageview or event. The client sends it for you. The body is JSON, and the client sends it as `text/plain` so browsers don't need a CORS preflight.

| Key | Type | Description |
|---|---|---|
| type | String | Required. See [`flame('track')`](#flametrack-type-data-category). |
| data | String | |
| category | String | |
| value | Number | The amount, for payments and subscriptions. |
| url | String | Required. The page's URL. Its domain must be allowed. |
| referrer, title, description, image | String | |
| session | Object or `false` | `id`, `visits`, `pageviews`, `new_visitor`, and `search` (`engine` and `query`). |
| browser | Object | `name`, `version` and `engine`. |
| os, mobile, language | String | |
| screen | Object | `width`, `height`, `depth` and `angle`. |
| viewport | Object | `width` and `height`. |
| timezone | Object | `offset` (hours) and `dst`. |
| cores | Number | |

Anything unknown or of the wrong type is dropped, and long values are cut short.

| Status | When |
|---|---|
| 204 | Stored. Also returned without storing anything when the request has `Sec-GPC: 1` or `DNT: 1`. |
| 400 | The body isn't JSON, or has no `type` or http(s) `url`. |
| 403 | The page's domain, or the request's `Origin`, isn't in `ALLOWED_DOMAINS`. |
| 413 | The body is over 64 KB. |

Errors are JSON: `{ "success": false, "warning": false, "error": "…" }`.

### GET /trending

```
GET /trending?domain=blog.example.com&range=86400&count=5
```

#### Request

| Key | Type | Default | Description |
|---|---|---|---|
| domain | String | _required_ | The domain to rank pages for, e.g. `blog.example.com`. It must be in `ALLOWED_DOMAINS`. The client defaults it to the page's domain. |
| type | String | `pageview` | `pageview`, `payment` or `subscription`. |
| count | Integer | `10` | How many results to return. `__MAX__` for the most allowed for the range. See [Limits](#limits). |
| range | Integer | `3600` | How many seconds back to look. `__MAX__` for 28 days. See [Limits](#limits). |
| format | String | `json` | `json` or `xml`. |
| category | String | _none_ | Only count this category. If empty or `false`, categories are ignored. If `__ALL__`, pageviews are ranked per category, and payments and subscriptions are given for each category as well as all together. |
| terms | String | _none_ | A JSON list of up to 10 words, like `["fire","hose"]`. Only pages whose title or URL contains one of them are ranked, ignoring case. Words can only have letters, numbers, spaces, hyphens and underscores. Pageviews only. |

#### Response

| Key | Type | Description |
|---|---|---|
| success | Boolean | `false` if there was an error. Warnings don't count. |
| warning | String or `false` | Why the request was changed, e.g. a range that was too long being cut to 28 days. |
| error | String or `false` | What went wrong. |
| count | Integer | How many results there are, not counting `__ALL__`. May be fewer than asked for. |
| results | Array or Object | Pages for pageviews; categories for payments and subscriptions. |

With `format=xml`, the same response is an XML document. Pages are `<result>` elements, and categories are `<category name="…">` elements.

| Status | When |
|---|---|
| 200 | Success, perhaps with a warning. |
| 400 | A parameter isn't valid. |
| 403 | The domain, or the request's `Origin`, isn't in `ALLOWED_DOMAINS`. |
| 500 | The Worker has no `CF_ACCOUNT_ID` or `CF_API_TOKEN`. |
| 502 | The Analytics Engine SQL API failed. |

#### Results for pageviews

An array, most viewed first.

| Key | Type | Example | Description |
|---|---|---|---|
| url | String | `'https://blog.example.com/post'` | The page's URL, or the data it was tracked with. |
| title | String | `'A post'` | The page's most recent title. |
| image | String | `'https://blog.example.com/post.png'` | |
| description | String | `'All about posts.'` | |
| domain | String | `'blog.example.com'` | |
| category | String | `'Updates'` | The page's most recent category, or the one it's ranked in with `category=__ALL__`. |
| count | Integer | 1203 | How many views it had in the range. |
| count_percentage | Percentage | 23 | Its share of all matching views in the range. |
| count_relative | Percentage | 73 | Its views as a percentage of the top result's. |

#### Results for payments and subscriptions

Subscriptions work the same way as payments. The results are an object keyed by category, most first. Without a category, it only has `__ALL__`. With `category=__ALL__`, it has `__ALL__` then each category.

| Key | Type | Example | Description |
|---|---|---|---|
| count | Integer | 1203 | How many payments there were in the range and category. |
| average | Integer | 536 | The average amount, rounded. |
| count_percentage | Percentage | 23 | Their share of all matching payments in the range. |
| count_relative | Percentage | 73 | Their count as a percentage of the top category's. |

```
GET /trending?domain=blog.example.com&type=payment&range=__MAX__&category=__ALL__

{
	"success": true,
	"warning": false,
	"error": false,
	"count": 3,
	"results": {
		"__ALL__": {
			"count": 1203,
			"average": 537,
			"count_percentage": 100,
			"count_relative": 100
		},
		"Windows": {
			"count": 800,
			"average": 536,
			"count_percentage": 67,
			"count_relative": 100
		},
		"Linux": {
			"count": 253,
			"average": 610,
			"count_percentage": 21,
			"count_relative": 32
		},
		"OS X": {
			"count": 150,
			"average": 420,
			"count_percentage": 12,
			"count_relative": 19
		}
	}
}
```

#### Limits

Requests can't look back more than 28 days, and the longer the range, the fewer results they can return. Anything over the limit is cut to it, with a warning.

| Range | Seconds | Most results |
|---|---|---|
| Up to 1 hour | 3600 | 100 |
| Up to 1 day | 86400 | 50 |
| Up to 1 week | 604800 | 20 |
| Up to 28 days | 2419200 | 10 |

Counts come from Analytics Engine, which samples data at high volume, so large counts are estimates.
