import pageviewsSql from '../../sql/trending-pageviews.sql';
import totalSql from '../../sql/trending-total.sql';
import valuesSql from '../../sql/trending-values.sql';
import { allowed, allowedOrigin } from './allowed';
import { fill, hex, number, query, type Row } from './analytics';
import { failure, json } from './respond';

const Types = ['pageview', 'payment', 'subscription'] as const;
type Type = (typeof Types)[number];

// Analytics Engine keeps three months, but the README limits requests to 28 days.
const MaxRange = 28 * 24 * 60 * 60;

export type Parameters = {
	type: Type;
	domain: string;
	count: number;
	range: number;
	// false to ignore categories, '__ALL__' for each category, or one category.
	category: string | false;
};

// The most results for a range, from the README's limits table.
export function maxCount(range: number): number {
	if (range <= 3600) {
		return 100;
	}
	if (range <= 86400) {
		return 50;
	}
	if (range <= 604800) {
		return 20;
	}
	return 10;
}

// Read and check GET /trending's query string. Everything that goes into SQL
// is checked here, or is the category, which only goes in as hex.
export function parameters(search: URLSearchParams): { error: string } | { parameters: Parameters; warnings: string[] } {
	const warnings: string[] = [];

	const type = search.get('type') || 'pageview';
	if (!(Types as readonly string[]).includes(type)) {
		return { error: 'type must be pageview, payment or subscription.' };
	}

	const domain = (search.get('domain') ?? '').toLowerCase();
	if (!/^[a-z0-9.-]{1,253}$/.test(domain)) {
		return { error: 'domain must be a hostname, like example.com.' };
	}

	let range = whole(search.get('range'), 3600, MaxRange);
	if (range === undefined) {
		return { error: 'range must be a number of seconds, or __MAX__.' };
	}
	if (range > MaxRange) {
		warnings.push(`range can't be more than 28 days (${MaxRange} seconds), so it was cut to that.`);
		range = MaxRange;
	}

	let count = whole(search.get('count'), 10, maxCount(range));
	if (count === undefined) {
		return { error: 'count must be a whole number, or __MAX__.' };
	}
	if (count > maxCount(range)) {
		warnings.push(`count can't be more than ${maxCount(range)} for that range, so it was cut to that.`);
		count = maxCount(range);
	}

	const format = search.get('format') || 'json';
	if (format === 'xml') {
		return { error: "format=xml isn't supported yet." };
	}
	if (format !== 'json') {
		return { error: 'format must be json or xml.' };
	}

	if (search.has('terms')) {
		return { error: "terms isn't supported yet." };
	}

	const category = search.get('category');
	return {
		parameters: {
			type: type as Type,
			domain,
			count,
			range,
			category: category === null || category === '' || category === 'false' ? false : category,
		},
		warnings,
	};
}

// A positive whole number, the default if missing, or the maximum for __MAX__.
function whole(value: string | null, fallback: number, max: number): number | undefined {
	if (value === null || value === '') {
		return fallback;
	}
	if (value === '__MAX__') {
		return max;
	}
	if (!/^\d+$/.test(value) || Number(value) < 1) {
		return undefined;
	}
	return Number(value);
}

// GET /trending
export async function trending(request: Request, env: Env): Promise<Response> {
	const checked = parameters(new URL(request.url).searchParams);
	if ('error' in checked) {
		return failure(400, checked.error);
	}
	const { parameters: p, warnings } = checked;
	if (!allowedOrigin(request, env)) {
		return failure(403, "This site isn't allowed to read trending data.");
	}
	if (!allowed(p.domain, env)) {
		return failure(403, `${p.domain} isn't allowed.`);
	}
	if (!env.CF_ACCOUNT_ID || !env.CF_API_TOKEN) {
		return failure(500, 'The Worker needs CF_ACCOUNT_ID and CF_API_TOKEN to query Analytics Engine.');
	}

	let results: Record<string, unknown>[] | Record<string, Record<string, number>>;
	try {
		results = p.type === 'pageview' ? await pageviews(env, p) : await values(env, p);
	} catch (error) {
		console.error(error);
		return failure(502, "Couldn't query Analytics Engine.");
	}
	return json(
		{
			success: true,
			warning: warnings.length ? warnings.join(' ') : false,
			error: false,
			count: Array.isArray(results) ? results.length : Object.keys(results).filter((key) => key !== '__ALL__').length,
			results,
		},
		200,
		{ 'Cache-Control': 'public, max-age=60' },
	);
}

// The values every template shares.
function common(env: Env, p: Parameters) {
	return {
		dataset: env.ANALYTICS_DATASET,
		domain: p.domain,
		type: p.type,
		seconds: p.range,
		where: p.category === false || p.category === '__ALL__' ? '' : `AND lower(hex(blob3)) = '${hex(p.category)}'`,
	};
}

// The most viewed pages, as an array.
async function pageviews(env: Env, p: Parameters): Promise<Record<string, unknown>[]> {
	const values = common(env, p);
	const [rows, totals] = await Promise.all([
		query(env, fill(pageviewsSql, { ...values, group: p.category === '__ALL__' ? ', blob3' : '', limit: p.count })),
		query(env, fill(totalSql, values)),
	]);
	const total = number(totals[0]?.count);
	const top = number(rows[0]?.count);
	return rows.map((row) => {
		const count = number(row.count);
		return {
			url: text(row.data),
			title: text(row.title),
			image: text(row.image),
			description: text(row.description),
			domain: p.domain,
			category: text(row.category),
			count,
			count_percentage: percent(count, total),
			count_relative: percent(count, top),
		};
	});
}

// Payments or subscriptions, as an object keyed by category. Without a
// category, that's only '__ALL__'. With '__ALL__', it's '__ALL__' then each
// category.
async function values(env: Env, p: Parameters): Promise<Record<string, Record<string, number>>> {
	const values = common(env, p);
	const [rows, totals] = await Promise.all([
		p.category === false ? Promise.resolve([] as Row[]) : query(env, fill(valuesSql, { ...values, limit: p.count })),
		query(env, fill(totalSql, values)),
	]);
	const total = number(totals[0]?.count);
	const top = number(rows[0]?.count);
	const results: Record<string, Record<string, number>> = {};
	if (p.category === false || p.category === '__ALL__') {
		results.__ALL__ = summary(total, number(totals[0]?.average), total, total);
	}
	for (const row of rows) {
		results[text(row.category)] = summary(number(row.count), number(row.average), total, top);
	}
	return results;
}

function summary(count: number, average: number, total: number, top: number): Record<string, number> {
	return {
		count,
		average: Math.round(average),
		count_percentage: percent(count, total),
		count_relative: percent(count, top),
	};
}

function percent(part: number, whole: number): number {
	return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

function text(value: unknown): string {
	return value === null || value === undefined ? '' : String(value);
}
