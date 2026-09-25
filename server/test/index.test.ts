import { exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

describe('unknown paths', () => {
	it('return a 404', async () => {
		const response = await exports.default.fetch('https://flame.example.com/nope');
		expect(response.status).toBe(404);
	});
});
