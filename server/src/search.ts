// The search engine and query a visitor came from, read from the page's referrer.

const Engines = [
	{ name: 'Google', host: 'google.', query: 'q' },
	{ name: 'Bing', host: 'bing.com', query: 'q' },
	{ name: 'Yahoo', host: 'search.yahoo.', query: 'p' },
	{ name: 'DuckDuckGo', host: 'duckduckgo.com', query: 'q' },
	{ name: 'Yandex', host: 'yandex.', query: 'text' },
	{ name: 'Baidu', host: 'baidu.com', query: 'wd' },
	{ name: 'Ecosia', host: 'ecosia.org', query: 'q' },
	{ name: 'AOL', host: 'search.aol.', query: 'q' },
	{ name: 'Ask', host: 'ask.com', query: 'q' },
];

// Query parameters that suggest an unlisted search engine.
const Fallbacks = ['q', 'query', 'term', 'p', 'wd', 'text'];

// Empty strings when the referrer isn't a search, or is on the page's own site.
// Most search engines no longer pass the query on, so it's often empty.
export function search(referrer: unknown, page: URL): { engine: string; query: string } {
	const none = { engine: '', query: '' };
	let url: URL;
	try {
		url = new URL(String(referrer));
	} catch {
		return none;
	}
	if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.hostname === page.hostname) {
		return none;
	}
	const engine = Engines.find((engine) => url.hostname.includes(engine.host));
	if (engine) {
		return { engine: engine.name, query: url.searchParams.get(engine.query) ?? '' };
	}
	const fallback = Fallbacks.find((name) => url.searchParams.get(name));
	return fallback ? { engine: 'Unknown', query: url.searchParams.get(fallback)! } : none;
}
