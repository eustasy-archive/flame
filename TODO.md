# TODO

Flame is a 2015 prototype, rebuilt as three parts:

- `client/`: browser scripts and the embed snippet
- `server/`: a Cloudflare Worker in TypeScript
- `sql/`: the Analytics Engine queries behind `/trending`, and the layout of each data point

Pageviews and events are stored in Workers Analytics Engine. It keeps data for three months, samples at high volume, and holds up to 20 strings (blobs) and 20 numbers (doubles) per data point. Only allowlisted domains can send data or read trending. Settings are made on the client with `flame('setting', …)`, so there's no settings table.

Everything planned is written and tested locally, but it hasn't run against a real Analytics Engine dataset yet.

## Before it's used

- [ ] Deploy it, and check `/trending`'s queries against a real dataset. They've only been tested against a stand-in for the SQL API, so the details taken from Cloudflare's docs haven't been checked: `argMax(…, timestamp)`, `lower(hex(…))`, `position(… IN lowerUTF8(…))`, and counts arriving as strings.
- [ ] Replace `flame.example.com` in the snippets with the Worker's hostname, and set `ALLOWED_DOMAINS` and `CF_ACCOUNT_ID` in `wrangler.jsonc`.
- [ ] Check Workers Cache on the deployed Worker, since `wrangler dev` and the tests don't emulate it. Request the same `/trending` URL twice with one `Origin`: the second should have `CF-Cache-Status: HIT`. Then with another `Origin`, which should be a `MISS` with that `Origin` in `Access-Control-Allow-Origin`.
- [ ] Consider an account-owned API token for `CF_API_TOKEN`, if Cloudflare counts those separately from a user's rate limit. The docs don't say.

## Waiting on others

- [ ] Remove the Vitest major-version `ignore` from `.github/dependabot.yml` once `@cloudflare/vitest-plugin` supports Vitest 5. Its peer range is `^4.1.0` as of 1.2.8, so Dependabot's Vitest 5 update ([#1](https://github.com/eustasy-archive/flame/pull/1)) can't install.

## Later

Lower priority, mostly from comparing Flame with [Plausible](https://github.com/plausible/analytics).

- [ ] **Stats API:** visitors, pageviews, bounce rate, visit duration and views per visit, over time. Break them down by page, entry and exit page, referrer, country, region and city, browser, OS, device, screen size and language. Flame already stores most of these, so it's mostly new `.sql` templates.
- [ ] **Dashboard** on top of the stats API, with shared links and embedding. It needs authentication, which Flame doesn't have.
- [ ] **Campaigns:** split `utm_*` parameters out of the URL in `/track`, since Analytics Engine's SQL has no documented URL functions, and group traffic into channels. All 20 blobs are in use, so something has to make room.
- [ ] **Single-page apps:** track a pageview on `pushState`, back and forward, and hash changes, instead of needing a `track` call for each.
- [ ] **Codeless events:** outbound link clicks, file downloads, form submissions and 404 pages.
- [ ] **Engagement:** scroll depth and time on page, sent when the page is hidden, for bounce rate and visit duration. 7 doubles are free.
- [ ] **Custom properties:** key/value pairs on events, beyond `data` and `category`.
- [ ] **Goals and conversion rates.**
- [ ] **Revenue currency:** payments and subscriptions have an amount but no currency.
- [ ] **Filtering:** bots, localhost, excluded pages, and a site owner's own visits.
- [ ] **Reports:** weekly or monthly email or Slack reports, and traffic spike alerts, from a cron trigger.
- [ ] **Integrations:** Google Search Console keywords, imports from Google Analytics or CSV, and CSV export.
- [ ] **Events API:** server-side tracking, like `/track` but authenticated, without the `Origin` check.
- [ ] **Longer history:** Analytics Engine keeps three months, so a cron trigger could copy daily totals to D1.
- [ ] **Rate-limit `/track`**, e.g. with Workers' Rate Limiting binding. The allowlist stops other sites' pages sending data, but not scripts that fake it.
