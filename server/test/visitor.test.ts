import { env } from 'cloudflare:workers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetSalt, visitor } from '../src/visitor';

const Chrome = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

function request(ip = '203.0.113.7', agent = Chrome): Request {
	return new Request('https://flame.example.com/track', { method: 'POST', headers: { 'CF-Connecting-IP': ip, 'User-Agent': agent } });
}

async function hash(...parts: string[]): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(parts.join('\n')));
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

describe('visitor', () => {
	beforeEach(async () => {
		forgetSalt();
		for (const { name } of (await env.SALTS.list()).keys) {
			await env.SALTS.delete(name);
		}
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(new Date('2026-09-25T12:00:00Z'));
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it('is the same for the same visitor to the same site on the same day', async () => {
		const id = await visitor(request(), env, 'blog.example.com');
		expect(id).toMatch(/^[0-9a-f]{32}$/);
		forgetSalt();
		expect(await visitor(request(), env, 'blog.example.com')).toBe(id);
	});

	it('differs by IP address, user agent and site', async () => {
		const id = await visitor(request(), env, 'blog.example.com');
		expect(await visitor(request('203.0.113.8'), env, 'blog.example.com')).not.toBe(id);
		expect(await visitor(request(undefined, 'Firefox'), env, 'blog.example.com')).not.toBe(id);
		expect(await visitor(request(), env, 'example.com')).not.toBe(id);
	});

	it('changes the next day', async () => {
		const today = await visitor(request(), env, 'blog.example.com');
		vi.setSystemTime(new Date('2026-09-26T00:00:01Z'));
		expect(await visitor(request(), env, 'blog.example.com')).not.toBe(today);
	});

	it('keeps a random salt in KV until an hour after the day ends', async () => {
		await visitor(request(), env, 'blog.example.com');
		const { keys } = await env.SALTS.list();
		expect(keys.map((key) => key.name)).toEqual(['salt:2026-09-25']);
		expect(keys[0].expiration).toBe(Date.UTC(2026, 8, 26, 1) / 1000);
		expect(await env.SALTS.get('salt:2026-09-25')).toMatch(/^[0-9a-f]{64}$/);
	});

	it('uses the salt already in KV, and stores nothing else', async () => {
		await env.SALTS.put('salt:2026-09-25', 'a'.repeat(64));
		const id = await visitor(request(), env, 'blog.example.com');
		expect(id).toBe(await hash('a'.repeat(64), 'blog.example.com', '203.0.113.7', Chrome));
		expect((await env.SALTS.list()).keys).toHaveLength(1);
	});
});
