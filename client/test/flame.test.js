import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// The built bundle, as the Worker serves it. `npm test` builds it first.
var Bundle = readFileSync(join(import.meta.dirname, '../../server/dist/public/flame.js'), 'utf8');

// Set up the page as the snippet leaves it, with calls queued, then load the bundle.
function load(Queued = [], Name = 'flame') {
	window.flm = Name;
	window[Name] = function() {
		( window[Name].q = window[Name].q || [] ).push(arguments);
	};
	Queued.forEach((Args) => window[Name].apply(null, Args));
	( 0, eval )( Bundle );
}

// What was sent with sendBeacon, as [ url, payload ].
async function sent() {
	return Promise.all(navigator.sendBeacon.mock.calls.map(async ([ Url, Body ]) => [ Url, JSON.parse(await Body.text()) ]));
}

describe('flame()', () => {
	beforeEach(() => {
		jsdom.reconfigure({ url: 'https://blog.example.com/post?id=1#comments' });
		document.head.innerHTML = '<title>A post</title><script src="https://flame.example.com/flame.js?v=1"></script>';
		localStorage.clear();
		navigator.sendBeacon = vi.fn(() => true);
		delete window.flame;
		delete window.fl;
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('sends a queued pageview to the server it was loaded from', async () => {
		load([ [ 'track', 'pageview' ] ]);
		var [ [ Url, Payload ] ] = await sent();
		expect(Url).toBe('https://flame.example.com/track');
		expect(Payload).toMatchObject({
			type: 'pageview',
			data: 'https://blog.example.com/post?id=1',
			category: '',
			value: 0,
			url: 'https://blog.example.com/post?id=1',
			title: 'A post'
		});
		expect(Payload).not.toHaveProperty('session');
		expect(Payload.screen).toHaveProperty('width');
		expect(Payload.timezone).toHaveProperty('offset');
		expect(navigator.sendBeacon.mock.calls[0][1].type).toBe('text/plain');
	});

	it('runs calls made after loading straight away', async () => {
		load();
		expect(navigator.sendBeacon).not.toHaveBeenCalled();
		window.flame('track', 'event', 'signup', 'Newsletter');
		var [ [ , Payload ] ] = await sent();
		expect(Payload).toMatchObject({ type: 'event', data: 'signup', category: 'Newsletter', value: 0 });
	});

	it("gives pageviews the page's section as their category", async () => {
		document.head.innerHTML += '<meta property="article:section" content="Sport">';
		load([ [ 'track', 'pageview' ], [ 'track', 'pageview', null, 'Chosen' ], [ 'track', 'event', 'play' ] ]);
		var Sent = await sent();
		expect(Sent.map(([ , Payload ]) => Payload.category)).toEqual([ 'Sport', 'Chosen', '' ]);
		expect(Sent[1][1].data).toBe('https://blog.example.com/post?id=1');
	});

	it('records payment amounts as a value', async () => {
		load([ [ 'track', 'payment', 1200, 'Linux' ] ]);
		var [ [ , Payload ] ] = await sent();
		expect(Payload).toMatchObject({ type: 'payment', data: '1200', category: 'Linux', value: 1200 });
	});

	it('stores nothing in the browser', async () => {
		document.cookie = '';
		load([ [ 'track', 'pageview' ], [ 'track', 'event', 'play' ] ]);
		expect(await sent()).toHaveLength(2);
		expect(localStorage.length).toBe(0);
		expect(sessionStorage.length).toBe(0);
		expect(document.cookie).toBe('');
	});

	it('prefers the browser named in User-Agent Client Hints', async () => {
		Object.defineProperty(navigator, 'userAgentData', { configurable: true, value: { brands: [ { brand: 'Chromium', version: '140' }, { brand: 'Brave', version: '140' } ] } });
		load([ [ 'track' ] ]);
		delete navigator.userAgentData;
		var [ [ , Payload ] ] = await sent();
		expect(Payload.browser).toEqual({ name: 'Brave', version: '140' });
	});

	it('leaves the browser to the server without Client Hints', async () => {
		load([ [ 'track' ] ]);
		var [ [ , Payload ] ] = await sent();
		expect(Payload.browser).toBe(false);
		expect(Payload).not.toHaveProperty('os');
	});

	it('uses the name in window.flm', async () => {
		load([ [ 'track' ] ], 'fl');
		expect(await sent()).toHaveLength(1);
		expect(typeof window.fl).toBe('function');
	});

	it('warns about unknown commands without throwing', () => {
		var Warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		load([ [ 'nonsense' ] ]);
		expect(() => window.flame('also-nonsense')).not.toThrow();
		expect(Warn).toHaveBeenCalledTimes(2);
	});

	it('falls back to fetch when sendBeacon fails', () => {
		navigator.sendBeacon = vi.fn(() => false);
		var Fetch = vi.spyOn(window, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));
		load([ [ 'track' ] ]);
		expect(Fetch).toHaveBeenCalledWith('https://flame.example.com/track', expect.objectContaining({ method: 'POST', keepalive: true }));
	});

	describe('privacy signals', () => {
		afterEach(() => {
			delete navigator.globalPrivacyControl;
			delete navigator.doNotTrack;
		});

		it.each([
			[ 'Global Privacy Control', 'globalPrivacyControl', true ],
			[ 'Do Not Track', 'doNotTrack', '1' ]
		])('collects and sends nothing with %s', (name, property, value) => {
			Object.defineProperty(navigator, property, { configurable: true, value: value });
			load([ [ 'track' ] ]);
			expect(navigator.sendBeacon).not.toHaveBeenCalled();
		});

		it("tracks when Do Not Track is '0'", () => {
			Object.defineProperty(navigator, 'doNotTrack', { configurable: true, value: '0' });
			load([ [ 'track' ] ]);
			expect(navigator.sendBeacon).toHaveBeenCalled();
		});

		it('can be ignored with honor-privacy-signals', () => {
			Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: true });
			load([ [ 'setting', 'honor-privacy-signals', false ], [ 'track' ] ]);
			expect(navigator.sendBeacon).toHaveBeenCalled();
		});
	});

	it('warns about unknown settings', () => {
		var Warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		load([ [ 'setting', 'dnt-honor', true ], [ 'setting', 'session', false ] ]);
		expect(Warn).toHaveBeenCalledWith('Flame doesn\'t know the setting "dnt-honor".');
		expect(Warn).toHaveBeenCalledWith('Flame doesn\'t know the setting "session".');
	});

	describe('trending', () => {
		it("fetches trending pages for this page's domain", async () => {
			var Results = { success: true, warning: false, error: false, count: 0, results: [] };
			var Fetch = vi.spyOn(window, 'fetch').mockResolvedValue(Response.json(Results));
			var Callback = vi.fn();
			load([ [ 'trending', { range: 7200, terms: [ 'fire', 'hose' ] }, Callback ] ]);
			await vi.waitFor(() => expect(Callback).toHaveBeenCalled());
			var Url = new URL(Fetch.mock.calls[0][0]);
			expect(Url.origin + Url.pathname).toBe('https://flame.example.com/trending');
			expect(Object.fromEntries(Url.searchParams)).toEqual({ domain: 'blog.example.com', range: '7200', terms: '["fire","hose"]', format: 'json' });
			expect(Callback).toHaveBeenCalledWith(Results);
		});

		it('lets the domain and type be chosen', async () => {
			var Fetch = vi.spyOn(window, 'fetch').mockResolvedValue(Response.json({}));
			load([ [ 'trending', { domain: 'example.com', type: 'payment', category: '__ALL__' }, () => {} ] ]);
			var Url = new URL(Fetch.mock.calls[0][0]);
			expect(Object.fromEntries(Url.searchParams)).toEqual({ domain: 'example.com', type: 'payment', category: '__ALL__', format: 'json' });
		});

		it('tells the callback when the fetch fails', async () => {
			vi.spyOn(window, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
			var Callback = vi.fn();
			load([ [ 'trending', {}, Callback ] ]);
			await vi.waitFor(() => expect(Callback).toHaveBeenCalled());
			expect(Callback).toHaveBeenCalledWith({ success: false, warning: false, error: "Flame couldn't fetch trending data." });
		});

		it("isn't stopped by privacy signals, since it tracks nothing", () => {
			Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: true });
			var Fetch = vi.spyOn(window, 'fetch').mockResolvedValue(Response.json({}));
			load([ [ 'trending', {}, () => {} ] ]);
			delete navigator.globalPrivacyControl;
			expect(Fetch).toHaveBeenCalled();
		});
	});

	it("sends nothing if it can't tell where it was loaded from", () => {
		document.head.innerHTML = '';
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		load([ [ 'track' ] ]);
		expect(navigator.sendBeacon).not.toHaveBeenCalled();
	});
});
