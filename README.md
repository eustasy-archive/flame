# Flame

Pageview and event tracking for your own sites, with an API for their trending pages. It runs as a Cloudflare Worker and stores data in Workers Analytics Engine. [TODO.md](TODO.md) lists what's left.

[![CI](https://github.com/eustasy-archive/flame/actions/workflows/ci.yml/badge.svg)](https://github.com/eustasy-archive/flame/actions/workflows/ci.yml)

| Folder | Contents |
|---|---|
| [`client/`](client/README.md) | The browser script and the snippet that loads it: the `flame()` commands, and what's collected. |
| [`server/`](server/README.md) | The Cloudflare Worker: setting it up, developing it, and its API. |
| [`sql/`](sql/README.md) | The layout of each Analytics Engine data point, and the queries behind `/trending`. |

## Quick start

1. **Deploy the Worker.** [Set it up](server/README.md#set-up), then run `npx wrangler deploy` from `server/`. It needs your Cloudflare account ID, an API token that can read Analytics Engine, and the list of sites allowed to use it.
2. **Add the snippet** to your pages, with your Worker's hostname in place of `flame.example.com`. It records a pageview on each page it's on.

   ```html
   <script>
   (function(e,x,t,i,n,g,u){e['flm']=n;e[n]=e[n]||function(){(
   e[n].q=e[n].q||[]).push(arguments)},e[n].l=1*new Date();g=x.createElement(t),
   u=x.getElementsByTagName(t)[0],g.async=1,g.src=i,u.parentNode.insertBefore(g,u)
   })(window,document,'script','https://flame.example.com/flame.js?v=1','flame');
   flame('track', 'pageview');
   </script>
   ```

3. **Get the trending pages** from any page with the snippet:

   ```js
   flame('trending', { range: 86400, count: 5 }, function(Trending) {
   	Trending.results.forEach(function(Page) {
   		console.log(Page.title, Page.url, Page.count);
   	});
   });
   ```

   Or from anywhere else, with `GET https://flame.example.com/trending?domain=example.com&range=86400&count=5`.

The [client](client/README.md#commands) and [server](server/README.md#api) READMEs cover the rest. To work on Flame itself, see [CONTRIBUTING.md](CONTRIBUTING.md).
