# Analytics Engine

The [Worker](../server/README.md) stores each pageview or event from `/track` as one data point in [Workers Analytics Engine](https://developers.cloudflare.com/analytics/analytics-engine/), in the dataset bound as `FLAME`, and `/trending` queries it with the templates here. The layout is defined in [`server/src/datapoint.ts`](../server/src/datapoint.ts). This page describes the same layout for anyone writing queries.

- **Timestamps** are added by Analytics Engine, in the `timestamp` column.
- **There are no row ids.** Data points can't be updated or deleted.
- **Data is kept for three months.**
- **Sampling:** at high volume, Analytics Engine stores a sample and records how many data points each one stands for in `_sample_interval`. Count with `SUM(_sample_interval)`, not `count()`, and average with `SUM(_sample_interval * doubleN) / SUM(_sample_interval)`.
- **Missing values** are `''` for blobs and `0` for doubles.

## Index

| Column | Field | Notes |
|---|---|---|
| `index1` | domain | The page's hostname, e.g. `blog.example.com`. It's also the sampling key, so each domain is sampled separately. |

## Blobs

Strings, cut to the byte limit shown.

| Column | Field | Bytes | Notes |
|---|---|---|---|
| `blob1` | type | 64 | `pageview`, `payment`, `subscription`, `404`, `outbound`, `download`, or a custom type such as `event`. |
| `blob2` | data | 1000 | For pageviews and 404s, the page's URL. For outbound links and downloads, the link's URL. For payments and subscriptions, the amount. Otherwise whatever the site passed. |
| `blob3` | category | 100 | |
| `blob4` | url | 1000 | The page's URL, without its fragment. |
| `blob5` | title | 300 | From `og:title`, microdata, `twitter:title`, or `<title>`. |
| `blob6` | description | 500 | |
| `blob7` | image | 1000 | |
| `blob8` | referrer | 1000 | This page's referrer. |
| `blob9` | search_engine | 100 | From this page's referrer, e.g. `Google`, or `Unknown`. Empty for links from the same site. |
| `blob10` | search_query | 300 | Often empty: most search engines no longer pass the query on. |
| `blob11` | visitor | 32 | A hash of a daily salt, the domain, and the visitor's IP address and user agent. The same for a visitor all day on one site, and different the next day. Count unique visitors with `count(DISTINCT blob11)`, though it's approximate when data is sampled. |
| `blob12` | browser | 100 | e.g. `Chrome`, `Firefox`. From User-Agent Client Hints where the browser has them, so Brave and Edge aren't counted as Chrome; otherwise, like the version, engine and OS, from the `User-Agent` header. |
| `blob13` | browser_version | 64 | |
| `blob14` | browser_engine | 100 | e.g. `Blink`, `Gecko`. |
| `blob15` | os | 100 | e.g. `Windows 10` or `iOS 18.5`. |
| `blob16` | mobile | 16 | `phone`, `tablet`, or empty. |
| `blob17` | language | 64 | From the browser, or the `Accept-Language` header. |
| `blob18` | country | 8 | From Cloudflare, e.g. `GB`. |
| `blob19` | region | 100 | From Cloudflare, e.g. `England`. |
| `blob20` | city | 100 | From Cloudflare. |

## Doubles

| Column | Field | Notes |
|---|---|---|
| `double1` | value | The amount of a payment or subscription, as an integer (e.g. pence). Otherwise 0. |
| `double2` | screen_width | |
| `double3` | screen_height | |
| `double4` | screen_depth | Colour depth in bits. |
| `double5` | screen_angle | Orientation angle: 0, 90, 180 or 270. |
| `double6` | viewport_width | |
| `double7` | viewport_height | |
| `double8` | timezone_offset | Hours from UTC, e.g. `1` or `-2.5`. |
| `double9` | timezone_dst | 1 if daylight saving time is in effect, otherwise 0. |
| `double10` | cores | The number of CPU cores the browser reports. |

## Queries

`/trending` runs these templates, which the Worker imports as text.

| File | For |
|---|---|
| [`trending-pageviews.sql`](trending-pageviews.sql) | The most viewed pages. |
| [`trending-categories.sql`](trending-categories.sql) | Pageviews by category. |
| [`trending-values.sql`](trending-values.sql) | Payments or subscriptions by category. |
| [`trending-total.sql`](trending-total.sql) | Totals, which percentages are worked out from. |

[`server/src/trending.ts`](../server/src/trending.ts) fills in each `{placeholder}` and drops the `--` comments. The SQL API has no query parameters and doesn't document how quotes in strings are escaped, so request values never go into a template as they are. Only these do:

- known types
- integers
- hostnames from the allowlist
- categories as hex, compared with `lower(hex(blob3))`
- search terms limited to letters, numbers, spaces, hyphens and underscores

A test checks each template's columns against the layout above.
