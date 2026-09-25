import { env, exports } from 'cloudflare:workers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { maxCount, trending } from '../src/trending';

// Stands in for the Analytics Engine SQL API, answering each query by its shape.
function api(rows: { pageviews?: object[]; values?: object[]; total?: object }) {
	return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
		const sql = String(init?.body);
		const data = sql.includes('argMax(') ? rows.pageviews : sql.includes('GROUP BY category') ? rows.values : [rows.total];
		return Response.json({ meta: [], data: data ?? [], rows: data?.length ?? 0 });
	});
}

// The SQL sent to the API, in order.
function sent(fetch: ReturnType<typeof api>): string[] {
	return fetch.mock.calls.map(([, init]) => String(init?.body));
}

async function get(query: string, init: RequestInit = {}) {
	const response = await exports.default.fetch(`https://flame.example.com/trending?${query}`, init);
	return { status: response.status, headers: response.headers, body: await response.json<Record<string, any>>() };
}

describe('/trending', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('pageviews', () => {
		let fetch: ReturnType<typeof api>;
		beforeEach(() => {
			fetch = api({
				pageviews: [
					{ data: 'https://blog.example.com/a', category: 'News', title: 'A', description: 'About A', image: 'https://blog.example.com/a.png', count: '30' },
					{ data: 'https://blog.example.com/b', category: '', title: 'B', description: '', image: '', count: '15' },
				],
				total: { count: '60', average: 0 },
			});
		});

		it('ranks pages for a domain', async () => {
			const { status, headers, body } = await get('domain=blog.example.com');
			expect(status).toBe(200);
			expect(headers.get('Cache-Control')).toBe('public, max-age=60');
			expect(body).toEqual({
				success: true,
				warning: false,
				error: false,
				count: 2,
				results: [
					{ url: 'https://blog.example.com/a', title: 'A', image: 'https://blog.example.com/a.png', description: 'About A', domain: 'blog.example.com', category: 'News', count: 30, count_percentage: 50, count_relative: 100 },
					{ url: 'https://blog.example.com/b', title: 'B', image: '', description: '', domain: 'blog.example.com', category: '', count: 15, count_percentage: 25, count_relative: 50 },
				],
			});
		});

		it('queries the SQL API with the account and token', async () => {
			await get('domain=blog.example.com');
			expect(fetch).toHaveBeenCalledTimes(2);
			const [url, init] = fetch.mock.calls[0];
			expect(url).toBe('https://api.cloudflare.com/client/v4/accounts/test-account/analytics_engine/sql');
			expect(init?.method).toBe('POST');
			expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer test-token');
		});

		it('fills in the templates', async () => {
			await get('domain=Blog.Example.com');
			const [pages, total] = sent(fetch);
			expect(pages).not.toContain('--');
			expect(pages).toContain('FROM flame');
			expect(pages).toContain("WHERE index1 = 'blog.example.com'");
			expect(pages).toContain("AND blob1 = 'pageview'");
			expect(pages).toContain("INTERVAL '3600' SECOND");
			expect(pages).toContain('GROUP BY data\n');
			expect(pages).toContain('LIMIT 10');
			expect(total).toContain("AND blob1 = 'pageview'");
			expect(total).toContain('SUM(_sample_interval) AS count');
		});

		it('filters by category as hex, so the category never goes into SQL', async () => {
			await get(`domain=blog.example.com&category=${encodeURIComponent("Editor's picks")}`);
			for (const sql of sent(fetch)) {
				expect(sql).toContain("AND lower(hex(blob3)) = '456469746f722773207069636b73'");
				expect(sql).not.toContain('Editor');
			}
		});

		it('groups by category with __ALL__', async () => {
			await get('domain=blog.example.com&category=__ALL__');
			const [pages, total] = sent(fetch);
			expect(pages).toContain('GROUP BY data, blob3');
			expect(total).not.toContain('hex(');
		});

		it('ignores categories with category=false', async () => {
			await get('domain=blog.example.com&category=false');
			for (const sql of sent(fetch)) {
				expect(sql).not.toContain('hex(');
			}
		});

		it('takes the most results for a range with __MAX__', async () => {
			await get('domain=blog.example.com&range=__MAX__&count=__MAX__');
			expect(sent(fetch)[0]).toContain("INTERVAL '2419200' SECOND");
			expect(sent(fetch)[0]).toContain('LIMIT 10');
		});

		it('cuts a range over 28 days, with a warning', async () => {
			const { body } = await get('domain=blog.example.com&range=9999999');
			expect(sent(fetch)[0]).toContain("INTERVAL '2419200' SECOND");
			expect(body.warning).toBe("range can't be more than 28 days (2419200 seconds), so it was cut to that.");
		});

		it('cuts count to the limit for the range, with a warning', async () => {
			const { body } = await get('domain=blog.example.com&range=86400&count=80');
			expect(sent(fetch)[0]).toContain('LIMIT 50');
			expect(body.warning).toBe("count can't be more than 50 for that range, so it was cut to that.");
		});
	});

	describe('payments and subscriptions', () => {
		// The example from the README.
		beforeEach(() => {
			api({
				values: [
					{ category: 'Windows', count: '800', average: 536.2 },
					{ category: 'Linux', count: '253', average: 610 },
					{ category: 'OS X', count: '150', average: 420 },
				],
				total: { count: '1203', average: 536 },
			});
		});

		it('gives __ALL__ and each category', async () => {
			const { body } = await get('domain=blog.example.com&type=payment&range=__MAX__&category=__ALL__');
			expect(body.count).toBe(3);
			expect(body.results).toEqual({
				__ALL__: { count: 1203, average: 536, count_percentage: 100, count_relative: 100 },
				Windows: { count: 800, average: 536, count_percentage: 67, count_relative: 100 },
				Linux: { count: 253, average: 610, count_percentage: 21, count_relative: 32 },
				'OS X': { count: 150, average: 420, count_percentage: 12, count_relative: 19 },
			});
			expect(Object.keys(body.results)[0]).toBe('__ALL__');
		});

		it('gives only __ALL__ without a category', async () => {
			const { body } = await get('domain=blog.example.com&type=subscription');
			expect(body.results).toEqual({ __ALL__: { count: 1203, average: 536, count_percentage: 100, count_relative: 100 } });
			expect(body.count).toBe(0);
		});

		it('queries subscriptions by type', async () => {
			const fetch = api({ values: [], total: { count: '0', average: null } });
			const { body } = await get('domain=blog.example.com&type=subscription&category=__ALL__');
			expect(sent(fetch).every((sql) => sql.includes("AND blob1 = 'subscription'"))).toBe(true);
			expect(body.results).toEqual({ __ALL__: { count: 0, average: 0, count_percentage: 0, count_relative: 0 } });
		});
	});

	it.each([
		['type=visits&domain=blog.example.com', 'type must be pageview, payment or subscription.'],
		['', 'domain must be a hostname, like example.com.'],
		["domain=blog.example.com'--", 'domain must be a hostname, like example.com.'],
		['domain=blog.example.com&range=-1', 'range must be a number of seconds, or __MAX__.'],
		['domain=blog.example.com&range=1e9', 'range must be a number of seconds, or __MAX__.'],
		['domain=blog.example.com&count=0', 'count must be a whole number, or __MAX__.'],
		['domain=blog.example.com&format=csv', 'format must be json or xml.'],
	])('rejects %s', async (query, error) => {
		const fetch = api({});
		const { status, body } = await get(query);
		expect(status).toBe(400);
		expect(body).toEqual({ success: false, warning: false, error });
		expect(fetch).not.toHaveBeenCalled();
	});

	it("rejects domains that aren't allowed", async () => {
		const fetch = api({});
		const { status, body } = await get('domain=evil.net');
		expect(status).toBe(403);
		expect(body.error).toBe("evil.net isn't allowed.");
		expect(fetch).not.toHaveBeenCalled();
	});

	it("rejects pages on sites that aren't allowed", async () => {
		const { status } = await get('domain=blog.example.com', { headers: { Origin: 'https://evil.net' } });
		expect(status).toBe(403);
	});

	it('reports when the SQL API fails', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('Unauthorized', { status: 401 }));
		const { status, body } = await get('domain=blog.example.com');
		expect(status).toBe(502);
		expect(body.error).toBe("Couldn't query Analytics Engine.");
	});

	it('says when the Worker has no API token', async () => {
		const response = await trending(new Request('https://flame.example.com/trending?domain=blog.example.com'), { ...env, CF_API_TOKEN: '' });
		expect(response.status).toBe(500);
		expect((await response.json<{ error: string }>()).error).toBe('The Worker needs CF_ACCOUNT_ID and CF_API_TOKEN to query Analytics Engine.');
	});

	it('only takes GET', async () => {
		const response = await exports.default.fetch('https://flame.example.com/trending?domain=blog.example.com', { method: 'POST' });
		expect(response.status).toBe(405);
	});
});

describe('maxCount', () => {
	it.each([
		[60, 100],
		[3600, 100],
		[3601, 50],
		[86400, 50],
		[604800, 20],
		[604801, 10],
		[2419200, 10],
	])('allows %i seconds %i results', (range, max) => {
		expect(maxCount(range)).toBe(max);
	});
});
