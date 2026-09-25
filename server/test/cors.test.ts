import { exports } from 'cloudflare:workers';
import { afterEach, describe, expect, it, vi } from 'vitest';

const track = (init: RequestInit) => exports.default.fetch('https://flame.example.com/track', init);

describe('CORS on /track', () => {
	it('answers preflights from allowed sites', async () => {
		const response = await track({ method: 'OPTIONS', headers: { Origin: 'https://blog.example.com', 'Access-Control-Request-Method': 'POST' } });
		expect(response.status).toBe(204);
		expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://blog.example.com');
		expect(response.headers.get('Access-Control-Allow-Methods')).toBe('PUT, POST');
		expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type');
		expect(response.headers.get('Vary')).toBe('Origin');
	});

	it("gives other sites no CORS headers", async () => {
		const response = await track({ method: 'OPTIONS', headers: { Origin: 'https://evil.net' } });
		expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
	});

	it('lets allowed sites read errors', async () => {
		const response = await track({ method: 'POST', body: 'nope', headers: { Origin: 'https://blog.example.com' } });
		expect(response.status).toBe(400);
		expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://blog.example.com');
	});

	it('adds nothing without an Origin', async () => {
		const response = await track({ method: 'POST', body: 'nope' });
		expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
		expect(response.headers.get('Vary')).toBe('Origin');
	});
});

describe('CORS on /trending', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('answers preflights from allowed sites', async () => {
		const response = await exports.default.fetch('https://flame.example.com/trending', { method: 'OPTIONS', headers: { Origin: 'https://example.com' } });
		expect(response.status).toBe(204);
		expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com');
		expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET');
	});

	it('lets allowed sites read results', async () => {
		vi.spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json({ data: [] }));
		const response = await exports.default.fetch('https://flame.example.com/trending?domain=blog.example.com', { headers: { Origin: 'https://blog.example.com' } });
		expect(response.status).toBe(200);
		expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://blog.example.com');
		expect(response.headers.get('Vary')).toBe('Origin');
	});

	it('gives other sites no CORS headers', async () => {
		const response = await exports.default.fetch('https://flame.example.com/trending?domain=blog.example.com', { headers: { Origin: 'https://evil.net' } });
		expect(response.status).toBe(403);
		expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
	});
});
