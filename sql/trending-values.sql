-- Payments or subscriptions on a domain by category, for
-- GET /trending?type=payment or ?type=subscription.
-- server/src/trending.ts fills in each {placeholder} with a value it has checked.
SELECT
	blob3 AS category,
	SUM(_sample_interval) AS count,
	SUM(_sample_interval * double1) / SUM(_sample_interval) AS average
FROM {dataset}
WHERE index1 = '{domain}'
	AND blob1 = '{type}'
	AND timestamp > now() - INTERVAL '{seconds}' SECOND
	{where}
GROUP BY category
ORDER BY count DESC
LIMIT {limit}
FORMAT JSON
