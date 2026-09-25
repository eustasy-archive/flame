# Flame

Pageview and event tracking for your own sites, with an API for their trending pages. It runs as a Cloudflare Worker and stores data in Workers Analytics Engine. [TODO.md](TODO.md) lists what's left.

[![CI](https://github.com/eustasy-archive/flame/actions/workflows/ci.yml/badge.svg)](https://github.com/eustasy-archive/flame/actions/workflows/ci.yml)

| Folder | Contents |
|---|---|
| [`client/`](client/README.md) | The browser script and the snippet that loads it: the `flame()` commands, and what's collected. |
| [`server/`](server/README.md) | The Cloudflare Worker: setting it up, developing it, and its API. |
| [`sql/`](sql/README.md) | The layout of each Analytics Engine data point, and the queries behind `/trending`. |

## Quick start

From `server/`, which has the tooling for both the Worker and the client:

```sh
npm install
npm test
npm run dev
```

Then [set up](server/README.md#set-up) and deploy the Worker, and paste [the snippet](client/README.md#the-snippet) into your pages, with your Worker's hostname in place of `flame.example.com`:

```html
<script>
(function(e,x,t,i,n,g,u){e['flm']=n;e[n]=e[n]||function(){(
e[n].q=e[n].q||[]).push(arguments)},e[n].l=1*new Date();g=x.createElement(t),
u=x.getElementsByTagName(t)[0],g.async=1,g.src=i,u.parentNode.insertBefore(g,u)
})(window,document,'script','https://flame.example.com/flame.js?v=1','flame');
flame('track', 'pageview');
</script>
```
