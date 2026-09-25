import { env, exports } from 'cloudflare:workers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const pageview = {
	type: 'pageview',
	data: 'https://blog.example.com/post',
	url: 'https://blog.example.com/post',
	title: 'A post',
	session: { id: 'abc123', visits: 1, pageviews: 1, new_visitor: true, search: { engine: false, query: false } },
};

function post(body: string, init: RequestInit = {}) {
	return exports.default.fetch('https://flame.example.com/track', {
		method: 'POST',
		headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
		body,
		...init,
	});
}

describe('/track', () => {
	let write: ReturnType<typeof vi.spyOn>;
	beforeEach(() => {
		write = vi.spyOn(env.FLAME, 'writeDataPoint');
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('stores a pageview', async () => {
		const response = await post(JSON.stringify(pageview));
		expect(response.status).toBe(204);
		expect(write).toHaveBeenCalledTimes(1);
		const point = write.mock.calls[0][0] as AnalyticsEngineDataPoint;
		expect(point.indexes).toEqual(['blog.example.com']);
		expect(point.blobs?.slice(0, 5)).toEqual(['pageview', 'https://blog.example.com/post', '', 'https://blog.example.com/post', 'A post']);
	});

	it('accepts PUT, as the README documents', async () => {
		expect((await post(JSON.stringify(pageview), { method: 'PUT' })).status).toBe(204);
	});

	it('rejects bodies that aren\'t JSON', async () => {
		const response = await post('type=pageview');
		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ success: false, warning: false, error: 'The body must be JSON.' });
		expect(write).not.toHaveBeenCalled();
	});

	it('rejects pageviews without a URL', async () => {
		const response = await post(JSON.stringify({ ...pageview, url: '' }));
		expect(response.status).toBe(400);
		expect((await response.json<{ error: string }>()).error).toBe("url must be the page's URL.");
	});

	it('rejects large bodies', async () => {
		const response = await post(JSON.stringify({ ...pageview, title: 'x'.repeat(70000) }));
		expect(response.status).toBe(413);
		expect(write).not.toHaveBeenCalled();
	});

	it.each([['Sec-GPC'], ['DNT']])('stores nothing with %s: 1', async (header) => {
		const response = await post(JSON.stringify(pageview), { headers: { [header]: '1' } });
		expect(response.status).toBe(204);
		expect(write).not.toHaveBeenCalled();
	});

	it('stores pageviews with DNT: 0', async () => {
		await post(JSON.stringify(pageview), { headers: { DNT: '0' } });
		expect(write).toHaveBeenCalled();
	});

	it("rejects domains that aren't allowed", async () => {
		const response = await post(JSON.stringify({ ...pageview, url: 'https://evil.net/' }));
		expect(response.status).toBe(403);
		expect((await response.json<{ error: string }>()).error).toBe("evil.net isn't allowed to send data.");
		expect(write).not.toHaveBeenCalled();
	});

	it("rejects pages on sites that aren't allowed", async () => {
		const response = await post(JSON.stringify(pageview), { headers: { Origin: 'https://evil.net' } });
		expect(response.status).toBe(403);
		expect(write).not.toHaveBeenCalled();
	});

	it('accepts pages on allowed sites', async () => {
		const response = await post(JSON.stringify(pageview), { headers: { Origin: 'https://blog.example.com' } });
		expect(response.status).toBe(204);
	});

	it('only takes PUT and POST', async () => {
		const response = await exports.default.fetch('https://flame.example.com/track');
		expect(response.status).toBe(405);
		expect(response.headers.get('Allow')).toBe('PUT, POST');
	});
});
