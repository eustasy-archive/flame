import pageviewsSql from '../../sql/trending-pageviews.sql';
import totalSql from '../../sql/trending-total.sql';
import valuesSql from '../../sql/trending-values.sql';
import { allowed, allowedOrigin } from './allowed';
import { fill, hex, number, query, type Row } from './analytics';
import { json } from './respond';
import { xml } from './xml';

const Types = ['pageview', 'payment', 'subscription'] as const;
type Type = (typeof Types)[number];

// Analytics Engine keeps data for three months.
const MaxRange = 90 * 24 * 60 * 60;
const MaxCount = 100;

export type Parameters = {
	type: Type;
	domain: string;
	count: number;
	range: number;
	// false to ignore categories, '__ALL__' for each category, or one category.
	category: string | false;
	// Lowercase words, of which a page's title or URL must contain one.
	terms: string[];
	format: Format;
};

type Format = 'json' | 'xml';

type Query = (sql: string) => Promise<Row[]>;

// Read and check GET /trending's query string. Everything that goes into SQL
// is checked here, or is the category, which only goes in as hex.
export function parameters(search: URLSearchParams): { error: string; format: Format } | { parameters: Parameters; warnings: string[] } {
	const warnings: string[] = [];

	// Read first, so any other error can be given in the format asked for.
	const format = search.get('format') || 'json';
	if (format !== 'json' && format !== 'xml') {
		return { error: 'format must be json or xml.', format: 'json' };
	}
	const failed = (error: string) => ({ error, format: format as Format });

	const type = search.get('type') || 'pageview';
	if (!(Types as readonly string[]).includes(type)) {
		return failed('type must be pageview, payment or subscription.');
	}

	const domain = (search.get('domain') ?? '').toLowerCase();
	if (!/^[a-z0-9.-]{1,253}$/.test(domain)) {
		return failed('domain must be a hostname, like example.com.');
	}

	let range = whole(search.get('range'), 3600, MaxRange);
	if (range === undefined) {
		return failed('range must be a number of seconds, or __MAX__.');
	}
	if (range > MaxRange) {
		warnings.push(`range can't be more than 90 days (${MaxRange} seconds), so it was cut to that.`);
		range = MaxRange;
	}

	let count = whole(search.get('count'), 10, MaxCount);
	if (count === undefined) {
		return failed('count must be a whole number, or __MAX__.');
	}
	if (count > MaxCount) {
		warnings.push(`count can't be more than ${MaxCount}, so it was cut to that.`);
		count = MaxCount;
	}

	const terms = words(search.get('terms'));
	if (terms === undefined) {
		return failed('terms must be a JSON list of up to 10 words, like ["fire","hose"]. Words can have letters, numbers, spaces, hyphens and underscores.');
	}
	if (terms.length && type !== 'pageview') {
		return failed('terms only works with type=pageview.');
	}

	const category = search.get('category');
	return {
		parameters: {
			type: type as Type,
			domain,
			count,
			range,
			category: category === null || category === '' || category === 'false' ? false : category,
			terms,
			format,
		},
		warnings,
	};
}

// The terms parameter: a JSON list of words, lowercased. They go into SQL, so
// they can only have letters, numbers, spaces, hyphens and underscores.
function words(value: string | null): string[] | undefined {
	if (value === null || value === '') {
		return [];
	}
	let list: unknown;
	try {
		list = JSON.parse(value);
	} catch {
		return undefined;
	}
	if (!Array.isArray(list) || list.length > 10) {
		return undefined;
	}
	const terms = list.map((term) => (typeof term === 'string' ? term.trim().toLowerCase() : ''));
	return terms.every((term) => /^[\p{L}\p{N} _-]{1,50}$/u.test(term)) ? terms : undefined;
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
		return failure(checked.format, 400, checked.error);
	}
	const { parameters: p, warnings } = checked;
	if (!allowedOrigin(request, env)) {
		return failure(p.format, 403, "This site isn't allowed to read trending data.");
	}
	if (!allowed(p.domain, env)) {
		return failure(p.format, 403, `${p.domain} isn't allowed.`);
	}
	if (!env.CF_ACCOUNT_ID || !env.CF_API_TOKEN) {
		return failure(p.format, 500, 'The Worker needs CF_ACCOUNT_ID and CF_API_TOKEN to query Analytics Engine.');
	}

	const run = (sql: string) => query(env, sql);
	let results: Record<string, unknown>[] | Record<string, Record<string, number>>;
	try {
		results = p.type === 'pageview' ? await pageviews(run, env, p) : await values(run, env, p);
	} catch (error) {
		console.error(error);
		return failure(p.format, 502, "Couldn't query Analytics Engine.");
	}
	// Workers Cache keeps successful responses for a minute, in front of the
	// Worker, so repeat requests don't reach the rate-limited SQL API. Responses
	// vary by Origin (see cors.ts), so each site gets its own CORS headers.
	return respond(
		p.format,
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

function respond(format: Format, body: Record<string, unknown>, status: number, headers: Record<string, string> = {}): Response {
	if (format === 'json') {
		return json(body, status, headers);
	}
	return new Response(xml(body), { status, headers: { 'Content-Type': 'application/xml; charset=utf-8', ...headers } });
}

function failure(format: Format, status: number, error: string): Response {
	return respond(format, { success: false, warning: false, error }, status);
}

// The values every template shares.
function common(env: Env, p: Parameters) {
	return {
		dataset: env.ANALYTICS_DATASET,
		domain: p.domain,
		type: p.type,
		seconds: p.range,
		where: [
			p.category === false || p.category === '__ALL__' ? '' : `AND lower(hex(blob3)) = '${hex(p.category)}'`,
			p.terms.length ? `AND (${p.terms.map((term) => `position('${term}' IN lowerUTF8(blob5)) > 0 OR position('${term}' IN lowerUTF8(blob2)) > 0`).join(' OR ')})` : '',
		]
			.filter(Boolean)
			.join('\n\t'),
	};
}

// The most viewed pages, as an array.
async function pageviews(run: Query, env: Env, p: Parameters): Promise<Record<string, unknown>[]> {
	const values = common(env, p);
	const [rows, totals] = await Promise.all([
		run(fill(pageviewsSql, { ...values, group: p.category === '__ALL__' ? ', blob3' : '', limit: p.count })),
		run(fill(totalSql, values)),
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
async function values(run: Query, env: Env, p: Parameters): Promise<Record<string, Record<string, number>>> {
	const values = common(env, p);
	const [rows, totals] = await Promise.all([
		p.category === false ? Promise.resolve([] as Row[]) : run(fill(valuesSql, { ...values, limit: p.count })),
		run(fill(totalSql, values)),
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
