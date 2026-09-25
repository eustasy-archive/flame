import { exports } from 'cloudflare:workers';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Workers Cache isn't emulated by Miniflare, so these check the headers it
// follows: Cache-Control for how long, and Vary for what to keep apart.
const fetch = (path: string, init: RequestInit = {}) => exports.default.fetch(`https://flame.example.com${path}`, init);

describe('what Workers Cache may keep', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('keeps /trending results for a minute, apart for each Origin', async () => {
		vi.spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json({ data: [] }));
		const response = await fetch('/trending?domain=blog.example.com', { headers: { Origin: 'https://blog.example.com' } });
		expect(response.status).toBe(200);
		expect(response.headers.get('Cache-Control')).toBe('public, max-age=60');
		expect(response.headers.get('Vary')).toBe('Origin');
		expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://blog.example.com');
	});

	it('keeps the client for an hour', async () => {
		const response = await fetch('/flame.js');
		expect(response.headers.get('Cache-Control')).toBe('public, max-age=3600');
		const etag = response.headers.get('ETag');
		expect(etag).toBeTruthy();
		const again = await fetch('/flame.js', { headers: { 'If-None-Match': etag! } });
		expect(again.status).toBe(304);
		expect(again.headers.get('Cache-Control')).toBe('public, max-age=3600');
	});

	it.each([
		['a bad /trending request', '/trending?domain=nope!', {}, 400],
		["a domain that isn't allowed", '/trending?domain=evil.net', {}, 403],
		["an Origin that isn't allowed", '/trending?domain=blog.example.com', { headers: { Origin: 'https://evil.net' } }, 403],
		['an unknown path', '/nope', {}, 404],
		['the wrong method', '/track', {}, 405],
	])("doesn't keep %s", async (name, path, init, status) => {
		const response = await fetch(path, init);
		expect(response.status).toBe(status);
		expect(response.headers.get('Cache-Control')).toBe('no-store');
	});

	it("doesn't keep a failed SQL API query", async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('Too many requests', { status: 429 }));
		const response = await fetch('/trending?domain=blog.example.com');
		expect(response.status).toBe(502);
		expect(response.headers.get('Cache-Control')).toBe('no-store');
	});
});
