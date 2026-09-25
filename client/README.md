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
| type | `pageview` | `pageview`, `payment`, `subscription`, or a type of your own, such as `event`. |
| data | The page's URL, for pageviews | What's being tracked. Pageviews default to the page's URL without its fragment. For payments and subscriptions, it's the amount, as an integer (e.g. pence) rather than a float. |
| category | _none_ | A category to group data by. |

### flame('setting', name, value)

| Setting | Default | Description |
|---|---|---|
| `honor-privacy-signals` | `true` | Collect, store and send nothing when the browser has [Global Privacy Control](https://globalprivacycontrol.org/) or Do Not Track turned on. |

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

The client stores nothing in the browser: no cookies, and nothing in localStorage. The Worker doesn't store IP addresses or user agents.

| Data | From |
|---|---|
| Browser, version, rendering engine, and operating system | The Worker, from the `User-Agent` header, with the browser's name and version from User-Agent Client Hints where the browser has them (`flame.hints.js`) |
| Visitor | The Worker. A visitor's ID is a hash of a daily salt, the site's domain, and the visitor's IP address and user agent, [as Plausible counts visitors](https://plausible.io/data-policy). Salts are deleted after their day, so an ID can't be traced back to an IP address, or linked to the same visitor on another day. |
| Search engine and query | The Worker, from the page's referrer. |
| Phone or tablet | `flame.device.js` |
| Page title, description and image | `flame.page.js`, from Open Graph, microdata and Twitter tags |
| Screen size, colour depth and orientation, and viewport size | `flame.display.js` |
| Language | `flame.language.js`, or the `Accept-Language` header |
| Timezone offset and daylight saving time | `flame.timezone.js` |
| Processor cores | `flame.processor.js` |
| Page URL and referrer | `location` and `document.referrer` |
| Country, region and city | Cloudflare, in the Worker (`request.cf`). IP addresses aren't stored. |

[`sql/README.md`](../sql/README.md) lists where each one is stored.

To work on the client, see [CONTRIBUTING.md](../CONTRIBUTING.md).
