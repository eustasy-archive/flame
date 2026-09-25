# Server

The Cloudflare Worker, in TypeScript. It serves the [client](../client/README.md) at `/flame.js`, stores pageviews and events from `/track` in Workers Analytics Engine, and answers `/trending` from Analytics Engine's SQL API. To work on it, see [CONTRIBUTING.md](../CONTRIBUTING.md).

## Set up

1. **Install.** Run `npm install` in this folder.
2. **Configure [`wrangler.jsonc`](wrangler.jsonc).**
   - `ALLOWED_DOMAINS`: the sites that may send data and read trending, separated by commas. `*.example.com` matches any subdomain of example.com, but not example.com itself. Nothing is allowed if it's empty.
   - `CF_ACCOUNT_ID`: your Cloudflare account ID, which `/trending` needs to query Analytics Engine.
   - `ANALYTICS_DATASET`: the dataset's name, which must match `dataset` under `analytics_engine_datasets`. It's `flame` unless you change both.
3. **Add an API token for `/trending`.** Create a Cloudflare API token with *Account Analytics: Read*, then run `npx wrangler secret put CF_API_TOKEN`. For `npm run dev`, copy `.dev.vars.example` to `.dev.vars` and put it there.
4. **Deploy.** `npx wrangler deploy` builds the client and deploys the Worker. Analytics Engine creates the dataset when the first data point is written.
5. **Embed [the snippet](../client/README.md#the-snippet)** on each page, with your Worker's hostname in place of `flame.example.com`, then add your `flame(…)` calls after it.

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
| count | Integer | `10` | How many results to return, up to 100. `__MAX__` for 100. |
| range | Integer | `3600` | How many seconds back to look, up to 90 days (7776000). `__MAX__` for 90 days. |
| format | String | `json` | `json` or `xml`. |
| category | String | _none_ | Only count this category. If empty or `false`, categories are ignored. If `__ALL__`, pageviews are ranked per category, and payments and subscriptions are given for each category as well as all together. |
| terms | String | _none_ | A JSON list of up to 10 words, like `["fire","hose"]`. Only pages whose title or URL contains one of them are ranked, ignoring case. Words can only have letters, numbers, spaces, hyphens and underscores. Pageviews only. |

#### Response

| Key | Type | Description |
|---|---|---|
| success | Boolean | `false` if there was an error. Warnings don't count. |
| warning | String or `false` | Why the request was changed, e.g. a range that was too long being cut to 90 days. |
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

A request can look back up to 90 days, since Analytics Engine keeps data for three months, and return up to 100 results. Anything over is cut to the limit, with a warning.

Counts come from Analytics Engine, which samples data at high volume, so large counts are estimates. Longer ranges are sampled more heavily.

#### SQL API limits

Each `/trending` request makes two queries to Analytics Engine's SQL API: one for the results, and one for the totals behind the percentages. The range and number of results don't change what a query costs.

- **Rate:** Cloudflare's API allows [1,200 requests per 5 minutes per user](https://developers.cloudflare.com/fundamentals/api/reference/limits/), counting everything that user does through the API and dashboard, not just Flame. That's at most 600 `/trending` requests per 5 minutes. Going over returns a 429 and blocks *all* of that user's API calls for 5 minutes, which Flame reports as a 502.
- **Cost:** Workers Free includes [10,000 read queries a day](https://developers.cloudflare.com/analytics/analytics-engine/pricing/), so 5,000 `/trending` requests. Workers Paid includes 1 million a month, then $1 per million. Cloudflare doesn't bill for Analytics Engine yet.

So successful `/trending` responses are cached for a minute by [Workers Cache](https://developers.cloudflare.com/workers/cache/), in front of the Worker, and browsers cache them for a minute too.
- **Shared and merged:** the cache is shared across Cloudflare's data centers, and simultaneous requests for the same thing are merged into one, so repeat requests don't reach the Worker or the SQL API.
- **Where it works:** on `workers.dev` as well as custom domains.
- **Keyed by the exact URL:** the path and query string, so `?range=60&count=5` and `?count=5&range=60` are cached separately.
- **Kept apart per site:** responses carry `Vary: Origin`, so each site gets its own copy, with its own CORS headers.
- **Errors aren't cached:** anything that fails, including a failed SQL API query, is sent with `Cache-Control: no-store`.
- **Each deploy starts with an empty cache.**
