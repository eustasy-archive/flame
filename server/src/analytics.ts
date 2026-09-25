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
export function hex(value: string): string {
	return Array.from(new TextEncoder().encode(value), (byte) => byte.toString(16).padStart(2, '0')).join('');
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

// The API returns 64-bit integers as strings, and NaN for averages of nothing.
export function number(value: unknown): number {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : 0;
}
