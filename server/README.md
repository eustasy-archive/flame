# Server

The Cloudflare Worker, in TypeScript. It serves the [client](../client/README.md) at `/flame.js`, stores pageviews and events from `/track` in Workers Analytics Engine, and answers `/trending` from Analytics Engine's SQL API. This folder also has the tooling for the client.

## Set up

1. **Install and test.** `npm install`, then `npm test`. The tests build the client first.
2. **Configure [`wrangler.jsonc`](wrangler.jsonc).**
   - `ALLOWED_DOMAINS`: the sites that may send data and read trending, separated by commas. `*.example.com` matches any subdomain of example.com, but not example.com itself. Nothing is allowed if it's empty.
   - `CF_ACCOUNT_ID`: your Cloudflare account ID, which `/trending` needs to query Analytics Engine.
   - `ANALYTICS_DATASET`: the dataset's name, which must match `dataset` under `analytics_engine_datasets`. It's `flame` unless you change both.
3. **Add an API token for `/trending`.** Create a Cloudflare API token with *Account Analytics: Read*, then run `npx wrangler secret put CF_API_TOKEN`. For `npm run dev`, copy `.dev.vars.example` to `.dev.vars` and put it there.
4. **Deploy.** `npx wrangler deploy` builds the client and deploys the Worker. Analytics Engine creates the dataset when the first data point is written.
5. **Embed [the snippet](../client/README.md#the-snippet)** on each page, with your Worker's hostname in place of `flame.example.com`, then add your `flame(…)` calls after it.

## Development

| Command | What it does |
|---|---|
| `npm run dev` | Runs the Worker locally with `wrangler dev`, building the client first. Data written there goes nowhere, but `/trending` queries the real Analytics Engine if it's configured. |
| `npm test` | Builds the client, then runs the Worker's tests (in the Workers runtime) and the client's (in jsdom). |
| `npm run build` | Bundles the client into `dist/public/`. |
| `npm run check` | Generates the Worker's types with `wrangler types`, then type-checks `src/` and `test/`. |

[CI](../.github/workflows/ci.yml) runs the build, tests, type check and a dry-run deploy on every push to `main` and every pull request.

## Files

| File | Contents |
|---|---|
| `src/index.ts` | Routing, and `/flame.js`. |
| `src/track.ts` | `/track`. |
| `src/datapoint.ts` | The data point layout, and turning a `/track` body into a data point. |
| `src/trending.ts` | `/trending`: checking its parameters and shaping its results. |
| `src/analytics.ts` | Filling in the [`sql/`](../sql/README.md) templates and querying the SQL API. |
| `src/allowed.ts` | The `ALLOWED_DOMAINS` allowlist. |
| `src/cors.ts` | CORS headers and preflights. |
| `src/xml.ts` | `/trending`'s XML format. |
| `src/respond.ts` | JSON and error responses. |
| `test/` | Tests, run in the Workers runtime by Vitest and `@cloudflare/vitest-plugin`. |

## API

### GET /flame.js

The [client](../client/README.md), minified. Add `?verbose` for a readable copy. It's cached for an hour; change the snippet's `?v=1` to fetch a new copy sooner.

### PUT or POST /track

Stores one pageview or event. The client sends it for you. The body is JSON, and the client sends it as `text/plain` so browsers don't need a CORS preflight.

| Key | Type | Description |
|---|---|---|
| type | String | Required. See [`flame('track')`](../client/README.md#flametrack-type-data-category). |
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
