# Contributing

How Flame is put together, and how to work on it. The [README](README.md) covers using it.

## Getting started

You'll need the current Node.js LTS. All the tooling lives in `server/`, including the client's: `client/` has no `package.json` of its own.

```sh
cd server
npm install
npm test
npm run dev
```

`npm install` also generates the Worker's types (`worker-configuration.d.ts`) with `wrangler types`. They're not committed, so rerun `npm run check` after changing `wrangler.jsonc`.

`npm run dev` serves the Worker at `http://localhost:8787`, building the client first.
- **`/track`:** what it writes locally goes nowhere.
- **`/trending`:** queries the real Analytics Engine. It needs `CF_ACCOUNT_ID` in `wrangler.jsonc` and `CF_API_TOKEN` in `.dev.vars` (copy `.dev.vars.example`).

## Commands

Run these in `server/`.

| Command | What it does |
|---|---|
| `npm run dev` | Runs the Worker locally with `wrangler dev`, building the client first. |
| `npm test` | Builds the client, then runs the Worker's tests (in the Workers runtime) and the client's (in jsdom). |
| `npm run build` | Bundles the client into `dist/public/flame.js` and a minified `flame.min.js`. |
| `npm run check` | Generates the Worker's types, then type-checks `src/` and `test/`. |

## How it fits together

1. **The snippet** on a page defines `flame()`, which queues calls, and loads `/flame.js` asynchronously.
2. **`/flame.js`** is `client/flame.js` and everything it imports, bundled by esbuild into one function so it adds nothing to the page. The Worker serves it from Workers Static Assets.
   - When it loads, it runs the queued calls, then replaces `flame()` so later calls run straight away.
   - `flame('track', …)` collects everything about the page and sends it to `/track` with `sendBeacon`.
3. **`/track`** (`server/src/track.ts`) checks the request against the allowlist and privacy headers.
   - `server/src/datapoint.ts` lays the body out as an Analytics Engine data point, adding what the request tells it: the browser and OS, search engine, location and language.
   - `server/src/visitor.ts` adds a cookie-free visitor ID, then the Worker writes the data point.
4. **`/trending`** (`server/src/trending.ts`) checks its parameters and the allowlist.
   - It fills in the `.sql` templates in `sql/` and queries Analytics Engine's SQL API (`server/src/analytics.ts`).
   - Workers Cache, in front of the Worker, keeps successful responses for a minute. It follows each response's `Cache-Control` and `Vary` headers, so anything without a `Cache-Control` header is sent with `no-store` (`cacheable()` in `server/src/index.ts`).
   - It shapes the rows into the response, as JSON or XML.

## Files

### client/

| File | Contents |
|---|---|
| `flame.js` | The entry point. It runs the snippet's queue and each command, and sends data. |
| `flame.auto.js` | The watchers behind [automatic tracking](client/README.md#automatic-tracking): history, link clicks and the page's status. |
| `flame.*.js` | One collector each. The [client README](client/README.md#whats-collected) lists what each collects. |
| `snippet.js`, `snippet.min.js` | The snippet, readable and minified. |
| `test/` | Tests, run in Vitest with jsdom. |

### server/

| File | Contents |
|---|---|
| `src/index.ts` | Routing, and `/flame.js`. |
| `src/track.ts` | `/track`. |
| `src/datapoint.ts` | The data point layout, and turning a `/track` body into a data point. |
| `src/visitor.ts` | Cookie-free visitor IDs, with a daily salt kept in the `SALTS` KV namespace. |
| `src/search.ts` | The search engine and query, from the page's referrer. |
| `src/useragent.ts` | Reading the browser, its engine and the OS from the `User-Agent` header, with [bowser](https://github.com/bowser-js/bowser). |
| `src/trending.ts` | `/trending`: checking its parameters and shaping its results. |
| `src/analytics.ts` | Filling in the `sql/` templates, and querying the SQL API. |
| `src/allowed.ts` | The `ALLOWED_DOMAINS` allowlist. |
| `src/cors.ts` | CORS headers and preflights. |
| `src/xml.ts` | `/trending`'s XML format. |
| `src/respond.ts` | JSON and error responses. |
| `src/env.d.ts`, `src/sql.d.ts` | Types for the secret, which `wrangler types` can't see, and for importing `.sql` files. |
| `test/` | Tests, run in the Workers runtime by Vitest and `@cloudflare/vitest-plugin`. |

### sql/

The `/trending` query templates, and [the data point layout](sql/README.md).

## Tests

`npm test` runs two Vitest projects, set up in `server/vitest.config.ts`.

- **`server`** runs `server/test/` inside the Workers runtime, through Miniflare.
  - Most tests go through the Worker with `exports.default.fetch`, as a real request would.
  - There's no real SQL API, so `/trending` tests spy on `fetch` and answer with made-up rows. That means the queries themselves have never run against Analytics Engine.
  - Neither the tests nor `wrangler dev` emulate Workers Cache, so `test/caching.test.ts` checks the `Cache-Control` and `Vary` headers it follows instead.
- **`client`** runs `client/test/` in jsdom.
  - Since `client/` has no `package.json`, the tests use Vitest's globals (`describe`, `it`, `expect`, `vi`) instead of importing them.
  - `setup.js` swaps Node's own `localStorage` for jsdom's.
  - The bundle, snippet and `flame()` tests run the built bundle, as a browser would, which is why `npm test` builds first.
  - The automatic tracking tests give each test a fresh jsdom window, since the bundle adds listeners that would otherwise fire in later tests.
  - A test also checks that the snippet in each README matches `snippet.min.js`.

## Making changes

### Collecting something new

1. Write a collector in `client/flame.<name>.js` that exports a function, and add what it returns to `collect()` in `client/flame.js`.
2. Store it in `server/src/datapoint.ts`, by adding a name to `Blobs` (strings) or `Doubles` (numbers), and a byte limit to `BlobBytes` for a string.
   - All 20 blobs are in use, so a new string means replacing one. 10 of the 20 doubles are in use.
   - Only ever add to the end of these lists. Analytics Engine stores values by position (`blob1`, `double1`…) and data can't be changed once written, so reordering them would change what older data means.
3. Add it to the tables in `sql/README.md`, in the same position, and to "What's collected" in the client README. A test checks `sql/README.md` matches the layout.
4. Test it: the collector in `client/test/`, and the layout in `server/test/datapoint.test.ts`.

### Changing /trending's queries

The queries are the `.sql` files in `sql/`, which the Worker imports as text. `fill()` in `server/src/analytics.ts` replaces each `{placeholder}` and drops `--` comments.

The SQL API has no query parameters and doesn't document how quotes in strings are escaped. So never put a request value into a template as it is: check it in `parameters()` in `server/src/trending.ts` first.
- **Types:** known words.
- **Domains:** hostnames on the allowlist.
- **Numbers:** integers.
- **Categories:** compared as hex, with `lower(hex(blob3))`.
- **Search terms:** limited to letters, numbers, spaces, hyphens and underscores.

`server/test/analytics.test.ts` checks that each `blobN AS name` in a template matches the layout. Because the tests only run against a stand-in, check a new query against a real dataset before relying on it.

### Changing the snippet

`snippet.min.js` is written by hand, not built. Change `snippet.js` and `snippet.min.js` together, then copy `snippet.min.js` into the root README's quick start and the client README's "The snippet". The snippet tests fail if any copy doesn't match or doesn't work.

### Client code

The client runs on other people's pages, so it:
- **never throws:** `run()` in `flame.js` catches and logs errors.
- **adds no globals:** the bundle is wrapped in a function.
- **stores nothing in the browser:** no cookies or localStorage. Visitors are counted by the Worker instead.
- **checks privacy signals first:** unless `honor-privacy-signals` is off, it collects nothing when Global Privacy Control or Do Not Track is on.

It's written in the style of the original 2015 code: `var` and `function`, tabs, `Title_Case` local variables, and a `////	Name` comment heading each file. esbuild bundles it for ES2017.

## CI and Dependabot

[CI](.github/workflows/ci.yml) runs on every push to `main` and every pull request, on the current Node.js LTS. It runs `npm ci`, the build, the tests and the type check, then `wrangler deploy --dry-run`, which bundles the Worker without deploying it.

[Dependabot](.github/dependabot.yml) checks GitHub Actions and `server/`'s npm packages daily.
- **Minor and patch updates** come grouped, one pull request per ecosystem.
- **Major updates** come one at a time.
- **Vitest major versions** are ignored until `@cloudflare/vitest-plugin` supports Vitest 5 (see [TODO.md](TODO.md)).

## Commits and TODO.md

Keep each commit to one change, with a message that says why. [TODO.md](TODO.md) tracks what's left: remove an item in the commit that finishes it.
