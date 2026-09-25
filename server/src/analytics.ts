// Querying Workers Analytics Engine through its SQL API.
//
// The API has no query parameters and doesn't document how quotes in strings
// are escaped, so nothing from a request goes into SQL as it is. Templates are
// only filled with values that trending.ts has checked: known words, integers,
// hostnames from the allowlist, and hex.

export type Row = Record<string, unknown>;

// Fill each {placeholder} in a .sql file, dropping its -- comments.
export function fill(template: string, values: Record<string, string | number>): string {
	return template
		.split('\n')
		.filter((line) => !line.trim().startsWith('--'))
		.join('\n')
		.replace(/\{(\w+)\}/g, (match, name: string) => {
			if (!(name in values)) {
				throw new Error(`No value for {${name}}.`);
			}
			return String(values[name]);
		})
		.trim();
}

// A string's UTF-8 bytes as lowercase hex, to compare a column against without
// putting the string in SQL: lower(hex(blob3)) = '…'.
export function hex(value: string | ArrayBuffer): string {
	const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : new Uint8Array(value);
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

// Run a query and return its rows. Throws if the API answers with an error.
export async function query(env: Env, sql: string): Promise<Row[]> {
	const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/analytics_engine/sql`, {
		method: 'POST',
		headers: { Authorization: `Bearer ${env.CF_API_TOKEN}` },
		body: sql,
	});
	if (!response.ok) {
		throw new Error(`Analytics Engine answered ${response.status}: ${await response.text()}`);
	}
	const body = await response.json<{ data?: Row[] }>();
	return body.data ?? [];
}

// How long each query's rows are cached, in seconds.
export const CacheSeconds = 60;

// Run queries through the Cache API: each query's rows are kept for a minute in
// the data center that ran it, so repeat requests don't reach the SQL API, which
// is rate-limited. Failed queries aren't cached. The Cache API only works when
// the Worker is on a custom domain: on workers.dev, nothing is cached.
export function cachedQuery(env: Env, ctx: ExecutionContext, origin: string): (sql: string) => Promise<Row[]> {
	return async (sql) => {
		const key = new Request(`${origin}/_cache/sql/${hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sql)))}`);
		const hit = await caches.default.match(key);
		if (hit) {
			return hit.json<Row[]>();
		}
		const rows = await query(env, sql);
		ctx.waitUntil(caches.default.put(key, Response.json(rows, { headers: { 'Cache-Control': `max-age=${CacheSeconds}` } })));
		return rows;
	};
}

// The API returns 64-bit integers as strings, and NaN for averages of nothing.
export function number(value: unknown): number {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : 0;
}
