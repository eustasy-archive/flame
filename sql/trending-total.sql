-- Totals for everything matching a GET /trending request, which its
-- percentages are worked out from.
-- server/src/trending.ts fills in each {placeholder} with a value it has checked.
SELECT
	SUM(_sample_interval) AS count,
	SUM(_sample_interval * double1) / SUM(_sample_interval) AS average
FROM {dataset}
WHERE index1 = '{domain}'
	AND blob1 = '{type}'
	AND timestamp > now() - INTERVAL '{seconds}' SECOND
	{where}
FORMAT JSON
