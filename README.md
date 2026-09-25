# Flame

Pageview and event tracking for your own sites, with an API for their trending pages. It runs as a Cloudflare Worker and stores data in Workers Analytics Engine. [TODO.md](TODO.md) lists what's left.

[![CI](https://github.com/eustasy-archive/flame/actions/workflows/ci.yml/badge.svg)](https://github.com/eustasy-archive/flame/actions/workflows/ci.yml)

| Folder | Contents |
|---|---|
| [`client/`](client/README.md) | The browser script and the snippet that loads it: the `flame()` commands, and what's collected. |
| [`server/`](server/README.md) | The Cloudflare Worker: setting it up, developing it, and its API. |
| [`sql/`](sql/README.md) | The layout of each Analytics Engine data point, and the queries behind `/trending`. |

`index.html` and `index.min.html` are example embeds of the snippet.

## Quick start

From `server/`, which has the tooling for both the Worker and the client:

```sh
npm install
npm test
npm run dev
```

Then [set up](server/README.md#set-up) and deploy the Worker, and [embed the snippet](client/README.md#the-snippet) in your pages.
