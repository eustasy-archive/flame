import { describe, expect, it } from 'vitest';
import { allowed, allowedOrigin } from '../src/allowed';

const env = (ALLOWED_DOMAINS: string) => ({ ALLOWED_DOMAINS }) as unknown as Env;

describe('allowed', () => {
	it.each([
		['example.com', 'example.com', true],
		['EXAMPLE.com', 'example.com', true],
		['blog.example.com', 'example.com', false],
		['blog.example.com', '*.example.com', true],
		['a.b.example.com', '*.example.com', true],
		['example.com', '*.example.com', false],
		['badexample.com', '*.example.com', false],
		['example.com.evil.net', 'example.com', false],
		['other.org', ' example.com , other.org ', true],
		['example.com', '', false],
		['', ',', false],
	])('%s in "%s" is %s', (hostname, list, expected) => {
		expect(allowed(hostname, env(list))).toBe(expected);
	});
});

describe('allowedOrigin', () => {
	const request = (origin?: string) => new Request('https://flame.example.com/', { headers: origin ? { Origin: origin } : {} });
	it('allows requests without an Origin, like curl', () => {
		expect(allowedOrigin(request(), env('example.com'))).toBe(true);
	});
	it('checks the Origin hostname', () => {
		expect(allowedOrigin(request('https://example.com'), env('example.com'))).toBe(true);
		expect(allowedOrigin(request('https://evil.net'), env('example.com'))).toBe(false);
		expect(allowedOrigin(request('null'), env('example.com'))).toBe(false);
	});
});
