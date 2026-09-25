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
			title: 'A post',
			session: { visits: 1, pageviews: 1, new_visitor: true }
		});
		expect(Payload.session.id).toMatch(/^[0-9a-f]{32}$/);
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

	it('records payment amounts as a value', async () => {
		load([ [ 'track', 'payment', 1200, 'Linux' ] ]);
		var [ [ , Payload ] ] = await sent();
		expect(Payload).toMatchObject({ type: 'payment', data: '1200', category: 'Linux', value: 1200 });
	});

	it('counts one pageview per page load, however many calls', async () => {
		load([ [ 'track', 'pageview' ], [ 'track', 'event', 'play' ] ]);
		var Sent = await sent();
		expect(Sent.map(([ , Payload ]) => Payload.session.pageviews)).toEqual([ 1, 1 ]);
		expect(Sent[1][1].session.id).toBe(Sent[0][1].session.id);
	});

	it('prefers the browser named in User-Agent Client Hints', async () => {
		Object.defineProperty(navigator, 'userAgentData', { configurable: true, value: { brands: [ { brand: 'Chromium', version: '140' }, { brand: 'Brave', version: '140' } ] } });
		load([ [ 'track' ] ]);
		delete navigator.userAgentData;
		var [ [ , Payload ] ] = await sent();
		expect(Payload.browser).toMatchObject({ name: 'Brave', version: '140' });
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
			expect(localStorage.getItem('flame_session')).toBeNull();
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

	it('can leave out the session, until a site has consent to store it', async () => {
		load([ [ 'setting', 'session', false ], [ 'track' ] ]);
		expect(localStorage.getItem('flame_session')).toBeNull();
		window.flame('setting', 'session', true);
		window.flame('track');
		var Sent = await sent();
		expect(Sent[0][1].session).toBe(false);
		expect(Sent[0][1]).toHaveProperty('mobile', false);
		expect(Sent[1][1].session).toMatchObject({ visits: 1, pageviews: 1 });
	});

	it('warns about unknown settings', () => {
		var Warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		load([ [ 'setting', 'dnt-honor', true ] ]);
		expect(Warn).toHaveBeenCalledWith('Flame doesn\'t know the setting "dnt-honor".');
	});

	it("sends nothing if it can't tell where it was loaded from", () => {
		document.head.innerHTML = '';
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		load([ [ 'track' ] ]);
		expect(navigator.sendBeacon).not.toHaveBeenCalled();
	});
});
