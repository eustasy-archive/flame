import { exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

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
