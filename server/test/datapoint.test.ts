import { describe, expect, it } from 'vitest';
import readme from '../../sql/README.md?raw';
import { BlobBytes, Blobs, Doubles, parse, truncate, withVisitor } from '../src/datapoint';

// What the client sends for a pageview.
const pageview = {
	type: 'pageview',
	data: 'https://blog.example.com/post?id=1',
	category: 'Updates',
	value: 0,
	url: 'https://blog.example.com/post?id=1',
	referrer: 'https://www.bing.com/search?q=fire+hose&form=QBLH',
	title: 'A post',
	description: 'About things',
	image: 'https://blog.example.com/i.png',
	browser: false,
	mobile: false,
	screen: { width: 2560, height: 1440, depth: 30, angle: 0 },
	viewport: { width: 1280, height: 720 },
	language: 'en-GB',
	timezone: { offset: 1, dst: true },
	cores: 16,
};

const Chrome = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

function request(headers: Record<string, string> = { 'User-Agent': Chrome }, cf: Record<string, string> = {}): Request {
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
		const point = named(pageview, request({ 'User-Agent': Chrome }, { country: 'GB', region: 'England', city: 'London' }));
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
			referrer: 'https://www.bing.com/search?q=fire+hose&form=QBLH',
			search_engine: 'Bing',
			search_query: 'fire hose',
			visitor: '',
			browser: 'Chrome',
			browser_version: '140.0.0.0',
			browser_engine: 'Blink',
			os: 'Windows 10',
			mobile: '',
			language: 'en-GB',
			country: 'GB',
			region: 'England',
			city: 'London',
		});
		expect(point.doubles).toEqual({
			value: 0,
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

	it('reads no search from a same-site referrer', () => {
		const point = named({ ...pageview, referrer: 'https://blog.example.com/search?q=fire' });
		expect(point.blobs).toMatchObject({ search_engine: '', search_query: '' });
	});

	it('adds the visitor ID in its place', () => {
		const parsed = parse(pageview, request());
		if ('error' in parsed) {
			throw new Error(parsed.error);
		}
		const point = withVisitor(parsed.point, 'f'.repeat(32));
		expect(point.blobs?.[Blobs.indexOf('visitor')]).toBe('f'.repeat(32));
		expect(point.blobs?.length).toBe(Blobs.length);
		expect(parsed.point.blobs?.[Blobs.indexOf('visitor')]).toBe('');
	});

	it('prefers the browser the client named from User-Agent Client Hints', () => {
		const point = named({ ...pageview, browser: { name: 'Brave', version: '140' } });
		expect(point.blobs).toMatchObject({ browser: 'Brave', browser_version: '140', browser_engine: 'Blink', os: 'Windows 10' });
	});

	it('copes without a User-Agent header', () => {
		const point = named(pageview, request({}));
		expect(point.blobs).toMatchObject({ browser: '', browser_version: '', browser_engine: '', os: '' });
	});

	it('drops values of the wrong type', () => {
		const point = named({ ...pageview, title: { html: '<b>' }, cores: 'lots', browser: 'Brave', screen: [1, 2] }, request({}));
		expect(point.blobs).toMatchObject({ title: '', browser: '' });
		expect(point.doubles).toMatchObject({ cores: 0, screen_width: 0 });
	});

	it('falls back to the Accept-Language header', () => {
		expect(named({ ...pageview, language: false }, request({ 'Accept-Language': 'fr-CA,fr;q=0.9,en;q=0.8' })).blobs.language).toBe('fr-CA');
		expect(named({ ...pageview, language: false }, request({ 'Accept-Language': '*' })).blobs.language).toBe('');
		expect(named({ ...pageview, language: false }, request({})).blobs.language).toBe('');
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

describe('sql/README.md', () => {
	it('documents the same layout, in the same order, with the same byte limits', () => {
		const blobs = Array.from(readme.matchAll(/^\| `blob(\d+)` \| (\w+) \| (\d+) \|/gm), ([, n, name, bytes]) => [Number(n), name, Number(bytes)]);
		const doubles = Array.from(readme.matchAll(/^\| `double(\d+)` \| (\w+) \|/gm), ([, n, name]) => [Number(n), name]);
		expect(blobs).toEqual(Blobs.map((name, i) => [i + 1, name, BlobBytes[name]]));
		expect(doubles).toEqual(Doubles.map((name, i) => [i + 1, name]));
	});
});
