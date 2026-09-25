# Client

The browser script that collects data about a page and sends it to the Worker, and the snippet that loads it. esbuild bundles [`flame.js`](flame.js) and everything it imports into one script, which the [Worker](../server/README.md) serves at `/flame.js`.

## The snippet

Paste this into each page, with your Worker's hostname in place of `flame.example.com`:

```html
<script>
(function(e,x,t,i,n,g,u){e['flm']=n;e[n]=e[n]||function(){(
e[n].q=e[n].q||[]).push(arguments)},e[n].l=1*new Date();g=x.createElement(t),
u=x.getElementsByTagName(t)[0],g.async=1,g.src=i,u.parentNode.insertBefore(g,u)
})(window,document,'script','https://flame.example.com/flame.js?v=1','flame');
flame('track', 'pageview');
</script>
```

The snippet loads `/flame.js` asynchronously and queues any `flame(…)` calls until it arrives, so it can go anywhere on the page. It adds two globals: `flame`, the function, and `flm`, the function's name. To use another name, change the snippet's last argument. Change its `?v=1` to make browsers fetch a new copy of the script sooner than their hour-long cache would.

It's kept in [`snippet.min.js`](snippet.min.js), with a readable copy in [`snippet.js`](snippet.js). A test checks that the READMEs match it.

After the snippet, a page can call any of the [commands](#commands):

```js
flame('track', 'pageview');
flame('track', 'payment', 1200, 'Linux');
flame('trending', { range: 7200 }, function(Trending) {
	console.log(Trending.results);
});
```

## Commands

### flame('track', type, data, category)

Sends one pageview or event to `/track`, along with everything [collected](#whats-collected) about the page.

| Argument | Default | Description |
|---|---|---|
| type | `pageview` | `pageview`, `payment`, `subscription`, `404`, or a type of your own, such as `event`. [Automatic tracking](#automatic-tracking) also sends `outbound` and `download`. |
| data | The page's URL, for pageviews and 404s | What's being tracked. Pageviews and 404s default to the page's URL, without its hash unless `track-hash` is on. For payments and subscriptions, it's the amount, as an integer (e.g. pence) rather than a float. |
| category | The page's section, for pageviews | A category to group data by. Pageviews without one take the page's section, from `article:section`, or schema.org's `articleSection` in microdata or JSON-LD, so automatic pageviews get one too. |

### flame('setting', name, value)

| Setting | Default | Description |
|---|---|---|
| `honor-privacy-signals` | `true` | Collect, store and send nothing when the browser has [Global Privacy Control](https://globalprivacycontrol.org/) or Do Not Track turned on. This includes automatic tracking. |
| `track-history` | `false` | Track a pageview each time a single-page app changes the URL. See [automatic tracking](#automatic-tracking). |
| `track-hash` | `false` | As `track-history`, but changes to the hash count as new pages too. |
| `track-outbound` | `false` | Track clicks on links to other sites. |
| `track-downloads` | `false` | Track clicks on links to files. |
| `track-404` | `false` | Track a `404` if the page was served as one. |

Settings apply to calls made after them, so put them first.

### flame('trending', options, callback)

Fetches [`/trending`](../server/README.md#get-trending) for the page's domain, and passes the parsed response to the callback. Options are `/trending`'s parameters, apart from `format`, with `terms` as a list of words. If the request fails, the callback gets `{ success: false, warning: false, error: '…' }`.

```js
flame('trending', { type: 'pageview', count: 5, range: 86400, terms: ['fire', 'hose'] }, function(Trending) {
	Trending.results.forEach(function(Page) {
		console.log(Page.title, Page.url, Page.count);
	});
});

// The most viewed categories, from the page's section or a track call.
flame('trending', { type: 'category', range: 86400 }, function(Trending) {
	Trending.results.forEach(function(Category) {
		console.log(Category.category, Category.count);
	});
});
```

## Automatic tracking

Each of these is off until a setting turns it on. Put the settings before your first `track` call:

```js
flame('setting', 'track-history', true);
flame('setting', 'track-outbound', true);
flame('setting', 'track-downloads', true);
flame('setting', 'track-404', true);
flame('track', 'pageview');
```

- **`track-history`:** single-page apps change the URL without loading a new page. With this on, Flame tracks a pageview whenever the URL changes, through `history.pushState` or the back and forward buttons. Changes to the hash alone don't count, and nor does going to the URL the page is already on. It waits a moment first, so the app can update the page's title.
- **`track-hash`:** for apps that route with the hash, such as `/app#/settings`. Hash changes count as new pages, and pageview URLs keep their hash. It includes `track-history`.
- **`track-outbound`:** clicks on links to other sites, as `outbound` events with the link's URL as their data. Middle clicks count, since they open a new tab.
- **`track-downloads`:** clicks on links to files, as `download` events with the link's URL, wherever the file is. A link counts if it has a `download` attribute, or ends in a file extension such as `.pdf`, `.zip`, `.docx`, `.csv` or `.mp4`.
- **`track-404`:** tracks a `404` event, with the page's URL as its data, if the page was served with a 404 status. Browsers only tell pages their status in Chrome and Edge (109 and later) and Firefox (129 and later). For Safari, call `flame('track', '404')` on your 404 page as well.

Flame uses `sendBeacon`, so a click that leaves the page is still sent.

## What's collected

The client stores nothing in the browser: no cookies, and nothing in localStorage. The Worker doesn't store IP addresses or user agents.

| Data | From |
|---|---|
| Browser, version, rendering engine, and operating system | The Worker, from the `User-Agent` header, with the browser's name and version from User-Agent Client Hints where the browser has them (`flame.hints.js`) |
| Visitor | The Worker. A visitor's ID is a hash of a daily salt, the site's domain, and the visitor's IP address and user agent, [as Plausible counts visitors](https://plausible.io/data-policy). Salts are deleted after their day, so an ID can't be traced back to an IP address, or linked to the same visitor on another day. |
| Search engine and query | The Worker, from the page's referrer. |
| Phone or tablet | `flame.device.js` |
| Page title, description and image, and section as the category | `flame.page.js`, from Open Graph, microdata, JSON-LD and Twitter tags |
| Screen size, colour depth and orientation, and viewport size | `flame.display.js` |
| Language | `flame.language.js`, or the `Accept-Language` header |
| Timezone offset and daylight saving time | `flame.timezone.js` |
| Processor cores | `flame.processor.js` |
| Page URL and referrer | `location` and `document.referrer` |
| Country, region and city | Cloudflare, in the Worker (`request.cf`). IP addresses aren't stored. |

[`sql/README.md`](../sql/README.md) lists where each one is stored.

To work on the client, see [CONTRIBUTING.md](../CONTRIBUTING.md).
