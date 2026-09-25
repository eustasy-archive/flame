import { search } from './search';
import { userAgent } from './useragent';

// How a pageview or event from /track is stored in Workers Analytics Engine.
// sql/README.md documents the same layout for anyone querying it, and the
// .sql files in sql/ read it.

// The blobs (strings), in order: blob1 is 'type', and so on. At most 20.
export const Blobs = [
	'type',
	'data',
	'category',
	'url',
	'title',
	'description',
	'image',
	'referrer',
	'search_engine',
	'search_query',
	'visitor',
	'browser',
	'browser_version',
	'browser_engine',
	'os',
	'mobile',
	'language',
	'country',
	'region',
	'city',
] as const;

// The doubles (numbers), in order: double1 is 'value', and so on. At most 20.
export const Doubles = [
	'value',
	'screen_width',
	'screen_height',
	'screen_depth',
	'screen_angle',
	'viewport_width',
	'viewport_height',
	'timezone_offset',
	'timezone_dst',
	'cores',
] as const;

export type Blob = (typeof Blobs)[number];
export type Double = (typeof Doubles)[number];

// The most bytes kept of each blob. A data point's blobs can total 16 KB.
export const BlobBytes: Record<Blob, number> = {
	type: 64,
	data: 1000,
	category: 100,
	url: 1000,
	title: 300,
	description: 500,
	image: 1000,
	referrer: 1000,
	search_engine: 100,
	search_query: 300,
	visitor: 32,
	browser: 100,
	browser_version: 64,
	browser_engine: 100,
	os: 100,
	mobile: 16,
	language: 64,
	country: 8,
	region: 100,
	city: 100,
};

// The index is the page's domain, which is also Analytics Engine's sampling key.
// It can be at most 96 bytes.
const IndexBytes = 96;

export type Parsed = { domain: string; point: AnalyticsEngineDataPoint } | { error: string };

// Turn the body the client sent to /track into a data point, filling in what the
// request itself knows: location from Cloudflare, and language if the client
// had none. Anything unexpected is dropped rather than rejected, apart from a
// missing type or a page URL that isn't http(s).
export function parse(body: unknown, request: Request): Parsed {
	const payload = object(body);
	const type = text(payload.type, BlobBytes.type);
	if (!type) {
		return { error: 'type is required.' };
	}
	let url: URL;
	try {
		url = new URL(String(payload.url));
	} catch {
		return { error: 'url must be the page\'s URL.' };
	}
	if (url.protocol !== 'http:' && url.protocol !== 'https:') {
		return { error: 'url must be the page\'s URL.' };
	}

	const found = search(payload.referrer, url);
	const browser = object(payload.browser);
	const screen = object(payload.screen);
	const viewport = object(payload.viewport);
	const timezone = object(payload.timezone);
	const cf = request.cf as IncomingRequestCfProperties | undefined;
	// The client only sends a browser when User-Agent Client Hints name it, since
	// Chromium browsers all look like Chrome in their user agent.
	const agent = userAgent(request.headers.get('User-Agent'));
	const brand = text(browser.name, BlobBytes.browser);

	const blobs: Record<Blob, unknown> = {
		type,
		data: payload.data,
		category: payload.category,
		url: url.href,
		title: payload.title,
		description: payload.description,
		image: payload.image,
		referrer: payload.referrer,
		search_engine: found.engine,
		search_query: found.query,
		// Filled in by withVisitor(), once the domain is known to be allowed.
		visitor: '',
		browser: brand || agent.browser,
		browser_version: brand ? browser.version : agent.version,
		browser_engine: agent.engine,
		os: agent.os,
		mobile: payload.mobile === 'phone' || payload.mobile === 'tablet' ? payload.mobile : '',
		language: text(payload.language, BlobBytes.language) || acceptLanguage(request.headers.get('Accept-Language')),
		country: cf?.country,
		region: cf?.region,
		city: cf?.city,
	};
	const doubles: Record<Double, unknown> = {
		value: payload.value,
		screen_width: screen.width,
		screen_height: screen.height,
		screen_depth: screen.depth,
		screen_angle: screen.angle,
		viewport_width: viewport.width,
		viewport_height: viewport.height,
		timezone_offset: timezone.offset,
		timezone_dst: timezone.dst,
		cores: payload.cores,
	};

	const domain = url.hostname;
	return {
		domain,
		point: {
			indexes: [truncate(domain, IndexBytes)],
			blobs: Blobs.map((name) => text(blobs[name], BlobBytes[name])),
			doubles: Doubles.map((name) => number(doubles[name])),
		},
	};
}

function object(value: unknown): Record<string, unknown> {
	return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

// Strings, numbers and booleans as text, cut to a number of bytes. The client
// sends false for anything it doesn't know, which becomes ''.
function text(value: unknown, bytes: number): string {
	if (typeof value === 'number' && Number.isFinite(value)) {
		value = String(value);
	}
	if (value === true) {
		value = 'true';
	}
	return typeof value === 'string' ? truncate(value.trim(), bytes) : '';
}

// Finite numbers, with booleans as 1 or 0. Anything else is 0.
function number(value: unknown): number {
	if (typeof value === 'boolean') {
		return value ? 1 : 0;
	}
	return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

// Cut a string to a number of UTF-8 bytes without splitting a character.
export function truncate(value: string, bytes: number): string {
	const encoded = encoder.encode(value);
	if (encoded.length <= bytes) {
		return value;
	}
	// A character cut in half decodes as U+FFFD at the end.
	return decoder.decode(encoded.slice(0, bytes)).replace(/�$/, '');
}

// The first language in an Accept-Language header, like 'en-GB' from 'en-GB,en;q=0.9'.
function acceptLanguage(header: string | null): string {
	const first = (header ?? '').split(',')[0].split(';')[0].trim();
	return first === '*' ? '' : truncate(first, BlobBytes.language);
}

// Add the visitor's ID (see visitor.ts) to a data point.
export function withVisitor(point: AnalyticsEngineDataPoint, id: string): AnalyticsEngineDataPoint {
	const blobs = [...(point.blobs ?? [])];
	blobs[Blobs.indexOf('visitor')] = id;
	return { ...point, blobs };
}
