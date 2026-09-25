-- Pageviews on a domain by category, most first, leaving out pages without a
-- category. For choosing the categories in GET /trending?category=__ALL__.
-- server/src/trending.ts fills in each {placeholder} with a value it has checked.
SELECT
	blob3 AS category,
	SUM(_sample_interval) AS count
FROM {dataset}
WHERE index1 = '{domain}'
	AND blob1 = 'pageview'
	AND blob3 != ''
	AND timestamp > now() - INTERVAL '{seconds}' SECOND
	{where}
GROUP BY category
ORDER BY count DESC
LIMIT {limit}
FORMAT JSON
