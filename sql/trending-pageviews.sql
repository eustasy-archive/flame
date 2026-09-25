-- The most viewed pages on a domain, for GET /trending?type=pageview.
-- server/src/trending.ts fills in each {placeholder} with a value it has checked.
SELECT
	blob2 AS data,
	argMax(blob3, timestamp) AS category,
	argMax(blob5, timestamp) AS title,
	argMax(blob6, timestamp) AS description,
	argMax(blob7, timestamp) AS image,
	SUM(_sample_interval) AS count
FROM {dataset}
WHERE index1 = '{domain}'
	AND blob1 = 'pageview'
	AND timestamp > now() - INTERVAL '{seconds}' SECOND
	{where}
GROUP BY data{group}
ORDER BY count DESC
LIMIT {limit}
FORMAT JSON
