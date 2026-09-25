import { describe, expect, it } from 'vitest';
import { BlobBytes, Blobs, Doubles, parse, truncate } from '../src/datapoint';

// What the client sends for a pageview.
const pageview = {
	type: 'pageview',
	data: 'https://blog.example.com/post?id=1',
	category: 'Updates',
	value: 0,
	url: 'https://blog.example.com/post?id=1',
	referrer: 'https://www.bing.com/',
	title: 'A post',
	description: 'About things',
	image: 'https://blog.example.com/i.png',
	session: { id: 'abc123', visits: 2, pageviews: 3, new_visitor: false, search: { engine: 'Bing', query: 'fire' } },
	browser: { name: 'Chrome', version: '140', engine: 'Blink' },
	os: 'Windows 10 64-bit',
	mobile: false,
	screen: { width: 2560, height: 1440, depth: 30, angle: 0 },
	viewport: { width: 1280, height: 720 },
	language: 'en-GB',
	timezone: { offset: 1, dst: true },
	cores: 16,
};

function request(headers: Record<string, string> = {}, cf: Record<string, string> = {}): Request {
	return new Request('https://flame.example.com/track', { method: 'POST', headers, cf });
}

// The parsed data point's blobs and doubles, by name.
function named(body: unknown, req = request()) {
	const parsed = parse(body, req);
	if ('error' in parsed) {
		throw new Error(parsed.error);
	}
	return {
		domain: parsed.domain,
		index: parsed.point.indexes?.[0],
		blobs: Object.fromEntries(Blobs.map((name, i) => [name, parsed.point.blobs?.[i]])),
		doubles: Object.fromEntries(Doubles.map((name, i) => [name, parsed.point.doubles?.[i]])),
	};
}

describe('layout', () => {
	it('fits in an Analytics Engine data point', () => {
		expect(Blobs.length).toBeLessThanOrEqual(20);
		expect(Doubles.length).toBeLessThanOrEqual(20);
		const total = Object.values(BlobBytes).reduce((sum, bytes) => sum + bytes, 0);
		expect(total).toBeLessThanOrEqual(16 * 1024);
	});
});

describe('parse', () => {
	it('lays out a pageview', () => {
		const point = named(pageview, request({}, { country: 'GB', region: 'England', city: 'London' }));
		expect(point.domain).toBe('blog.example.com');
		expect(point.index).toBe('blog.example.com');
		expect(point.blobs).toEqual({
			type: 'pageview',
			data: 'https://blog.example.com/post?id=1',
			category: 'Updates',
			url: 'https://blog.example.com/post?id=1',
			title: 'A post',
			description: 'About things',
			image: 'https://blog.example.com/i.png',
			referrer: 'https://www.bing.com/',
			search_engine: 'Bing',
			search_query: 'fire',
			session: 'abc123',
			browser: 'Chrome',
			browser_version: '140',
			browser_engine: 'Blink',
			os: 'Windows 10 64-bit',
			mobile: '',
			language: 'en-GB',
			country: 'GB',
			region: 'England',
			city: 'London',
		});
		expect(point.doubles).toEqual({
			value: 0,
			visits: 2,
			session_pageviews: 3,
			new_visitor: 0,
			screen_width: 2560,
			screen_height: 1440,
			screen_depth: 30,
			screen_angle: 0,
			viewport_width: 1280,
			viewport_height: 720,
			timezone_offset: 1,
			timezone_dst: 1,
			cores: 16,
		});
	});

	it('keeps payment amounts and phone/tablet', () => {
		const point = named({ ...pageview, type: 'payment', data: '1200', value: 1200, mobile: 'tablet' });
		expect(point.blobs).toMatchObject({ type: 'payment', data: '1200', mobile: 'tablet' });
		expect(point.doubles.value).toBe(1200);
	});

	it('copes without a session', () => {
		const point = named({ ...pageview, session: false });
		expect(point.blobs).toMatchObject({ session: '', search_engine: '', search_query: '' });
		expect(point.doubles).toMatchObject({ visits: 0, session_pageviews: 0, new_visitor: 0 });
	});

	it('drops values of the wrong type', () => {
		const point = named({ ...pageview, title: { html: '<b>' }, cores: 'lots', browser: 'Chrome', screen: [1, 2] });
		expect(point.blobs).toMatchObject({ title: '', browser: '' });
		expect(point.doubles).toMatchObject({ cores: 0, screen_width: 0 });
	});

	it('falls back to the Accept-Language header', () => {
		expect(named({ ...pageview, language: false }, request({ 'Accept-Language': 'fr-CA,fr;q=0.9,en;q=0.8' })).blobs.language).toBe('fr-CA');
		expect(named({ ...pageview, language: false }, request({ 'Accept-Language': '*' })).blobs.language).toBe('');
		expect(named({ ...pageview, language: false }).blobs.language).toBe('');
	});

	it('cuts long values to their byte limit', () => {
		const point = named({ ...pageview, title: 'é'.repeat(400) });
		expect(point.blobs.title).toBe('é'.repeat(150));
	});

	it.each([
		['not an object', 'pageview', 'type is required.'],
		['no type', { ...pageview, type: '' }, 'type is required.'],
		['no url', { ...pageview, url: undefined }, "url must be the page's URL."],
		['a non-web url', { ...pageview, url: 'javascript:alert(1)' }, "url must be the page's URL."],
	])('rejects %s', (name, body, error) => {
		expect(parse(body, request())).toEqual({ error });
	});
});

describe('truncate', () => {
	it("doesn't split characters", () => {
		expect(truncate('ab€', 4)).toBe('ab');
		expect(truncate('ab€', 5)).toBe('ab€');
		expect(truncate('😀😀', 6)).toBe('😀');
	});
});
