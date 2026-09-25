import { exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

describe('/flame.js', () => {
	it('serves the minified bundle', async () => {
		const response = await exports.default.fetch('https://flame.example.com/flame.js?v=1');
		expect(response.status).toBe(200);
		expect(response.headers.get('Content-Type')).toBe('text/javascript; charset=utf-8');
		expect(response.headers.get('Cache-Control')).toBe('public, max-age=3600');
		const body = await response.text();
		expect(body).toMatch(/^\(\(\)=>\{/);
		expect(body).not.toContain('function session(');
	});

	it('serves the readable bundle with ?verbose', async () => {
		const response = await exports.default.fetch('https://flame.example.com/flame.js?verbose');
		expect(response.status).toBe(200);
		expect(await response.text()).toContain('function session(');
	});

	it('answers HEAD requests', async () => {
		const response = await exports.default.fetch('https://flame.example.com/flame.js', { method: 'HEAD' });
		expect(response.status).toBe(200);
	});

	it.each(['/flame.min.js', '/inline', '/script'])("doesn't serve %s", async (path) => {
		const response = await exports.default.fetch('https://flame.example.com' + path);
		expect(response.status).toBe(404);
	});

	it('rejects other methods', async () => {
		const response = await exports.default.fetch('https://flame.example.com/flame.js', { method: 'POST' });
		expect(response.status).toBe(405);
		expect(response.headers.get('Allow')).toBe('GET, HEAD');
	});
});
