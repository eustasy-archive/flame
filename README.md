# Flame

Pageview and event tracking, with an API for trending pages. Unfinished; see [TODO.md](TODO.md).

| Folder | Contents |
|---|---|
| `client/` | Browser scripts that collect pageview data, and the embed snippet (`flame.inline.js`). |
| `server/` | A Cloudflare Worker that serves the client bundle and handles `/track` and `/trending`. |
| `sql/` | The database schema. |

`index.html` and `index.min.html` are example embeds of the snippet.

## API

### get /script

Fetches an asynchronous code snippet (which is surprisingly [well supported](http://caniuse.com/#feat=script-async)) that does all of the work once you've made your decisions. Not something you access directly, you use the snippet in [client/flame.inline.js](client/flame.inline.js).

```
flame('setting', 'honor-privacy-signals', true);
flame('setting', 'session', false);
flame('track', 'pageview', 'Funny');
flame('track', 'payment', 1200, 'Linux');
flame('trending', { range: 7200 }, function(Trending) {
	console.log(Trending.results);
});
console.log(window.flame.q);
```

##### Operating System (Version) & Browser & Browser Version & Rendering Engine
`client/lib.platform.js` ([Platform.js](https://github.com/bestiejs/platform.js)), with the browser's name and version from `client/flame.hints.js` (User-Agent Client Hints) where the browser supports them.
##### Session & Referrer & Search & Visits (New User)
`client/flame.session.js`
##### Mobile
`client/flame.device.js`
##### Page Title & Description & Image
`client/flame.page.js`
##### Timezone
`client/flame.timezone.js`
##### Processor Cores
`client/flame.processor.js`
##### Screen Resolution & Orientation & Depth & Viewport
`client/flame.display.js`
##### Language
`client/flame.language.js`: `navigator.languages ? navigator.languages[0] : ( navigator.userLanguage || navigator.systemLanguage || navigator.browserLanguage || navigator.language || false )`

Falls back to the `Accept-Language` request header on the server.
##### Request
`location`
##### Pageview & Location
Server-side. Location comes from `request.cf` (country, region, city) in the Worker.

### put (post) /track
| Key | Type | Default | Description |
|---|---|---|---|
| type | String | `pageview` | The type of thing to rank. `pageview` and other custom types such as `event` are currently accepted. |
| data | String | `location.href` | The data to track the _type_ for. Defaults to `location.href` for `pageview`, required for others. Payments and Subscriptions should use integer values instead of floats to store price. |
| category | String | _none_ | The category to classify data. |


### get /trending

```
flame('trending', { type: 'pageview', domain: location.hostname, count: 10, range: '__MAX__' }, function(Trending) {
	console.log(Trending.results);
});
```

#### Request
| Key | Type | Default | Description |
|---|---|---|---|
| type | String | `pageview` | The type of thing to rank. `pageview`, `subscription` and `payment` are currently accepted.  |
| domain | String | `location.host` | The domain for which to retrieve trending URLs. Must be URL-encoded. Limits apply. |
| count | Integer | `10` | The number of trending articles to fetch. |
| range | Integer | `3600` | The number of seconds for the trending topics to be selected from. |
| format | Select | `json` | The format for returned results from 'json' or 'xml'. |
| category | String | _none_ | The category from which to select data. If none or false, return results without a category. If `__ALL__`, return an all category, and each category in the time period. |
| terms | String | _none_ | JSON encoded list of terms to search for. |

#### Response
| Key | Type | Default | Description |
|---|---|---|---|
| success | Boolean | `true` | Whether or not the query parameters were met. `false` on error only, warnings are ignored. |
| warning | BoolString | `false` | Whether or not the query parameters were met with any warnings. String when warnings occur, `false` when not. |
| error | BoolString | `false` | Whether or not the query parameters were met with any error. String when error occur, `false` when not. |
| count | Integer | `10` | The number of trending articles fetched. May not match input. |
| results | Array | N/a | An array of returned links. |

#### Results for Page Views
| Key | Type | Example | Description |
|---|---|---|---|
| url | String | '' |  |
| title | String | '' |  |
| image | String | '' |  |
| description | String | '' |  |
| domain | String | 'example.com' | The domain the post is from. |
| category | String | 'Updates' | The category which the post belongs to. |
| count | Integer | 1203 | The amount of views in the specified time period. |
| count_percentage | Percentage | 23 | The percentage of all matching views in the specified time period. |
| count_relative | Percentage | 73 | The relative amount of views to other returned results. |

#### Results for Subscriptions

#### Results for Payments
| Key | Type | Example | Description |
|---|---|---|---|
| category | String | 'Updates' | The category which the post belongs to. If no category in request was specified, then categories will be ignored. |
| count | Integer | 1203 | The amount of payments in the specified time period and category. |
| average | Integer | 536 | The average of payments in the specified time period and category. |
| count_percentage | Percentage | 23 | The percentage of all matching payments in the specified time period. |
| count_relative | Percentage | 73 | The relative amount of payments to other returned results. |

```
GET: /trending?type=payment&range=__MAX__&category=__ALL__

{
	"__ALL__": {
		"count": 1203,
		"average": 536,
		"count_percentage": 100,
		"count_relative": 100
	},
	"Windows": {
		"count": 800,
		"average": 536,
		"count_percentage": 67,
		"count_relative": 100
	},
	"OS X": {
		"count": 150,
		"average": 536,
		"count_percentage": 12,
		"count_relative": 19
	},
	"Linux": {
		"count": 253,
		"average": 536,
		"count_percentage": 21,
		"count_relative": 31
	}
}

```

#### Limits
Domain fetches cannot span more than 28 days. We imagine most people will be satisfied with these limits.

| Time | Integer | Maximum Results |
|---|---|---|
| 1 Month (28 days) | 2419200 | 10 |
| 1 Week (7 Days) | 604800 | 20 |
| 1 Day | 86400 | 50 |
| 1 Hours | 3600 | 100 |
