import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// The built bundle, as the Worker serves it. `npm test` builds it first.
var Bundle = readFileSync(join(import.meta.dirname, '../../server/dist/public/flame.js'), 'utf8');

// A fresh page for each test, since the bundle adds listeners that would
// otherwise carry over into other tests. Link clicks don't navigate.
function open(Url = 'https://blog.example.com/post?id=1', Body = '', Status = 200) {
	var Window = new jsdom.constructor(
		'<!doctype html><title>A post</title><script src="https://flame.example.com/flame.js"></script>' + Body,
		{ url: Url, runScripts: 'outside-only' }
	).window;
	Window.navigator.sendBeacon = vi.fn(() => true);
	Window.performance.getEntriesByType = (Type) => ( Type == 'navigation' ? [ { responseStatus: Status } ] : [] );
	Window.addEventListener('click', (Event) => Event.preventDefault());
	return Window;
}

// Load Flame on a page, as the snippet does, with these calls queued.
function load(Window, Queued) {
	Window.eval("window.flm = 'flame'; window.flame = function() { ( window.flame.q = window.flame.q || [] ).push(arguments); };");
	Queued.forEach((Args) => Window.flame.apply(null, Args));
	Window.eval(Bundle);
}

// What was sent, as [ type, data, url ].
async function sent(Window) {
	return Promise.all(Window.navigator.sendBeacon.mock.calls.map(async ([ , Body ]) => {
		var Payload = JSON.parse(await Body.text());
		return [ Payload.type, Payload.data, Payload.url ];
	}));
}

function click(Window, Selector, Init = {}) {
	Window.document.querySelector(Selector).dispatchEvent(new Window.MouseEvent(Init.type || 'click', { bubbles: true, cancelable: true, button: Init.button || 0 }));
}

// Let a pageview queued by the history watcher go.
var tick = () => new Promise((Resolve) => setTimeout(Resolve, 10));

describe('track-history', () => {
	it('tracks a pageview when a single-page app changes the URL', async () => {
		var Window = open();
		load(Window, [ [ 'setting', 'track-history', true ], [ 'track', 'pageview' ] ]);
		Window.history.pushState({}, '', '/next');
		await tick();
		expect(await sent(Window)).toEqual([
			[ 'pageview', 'https://blog.example.com/post?id=1', 'https://blog.example.com/post?id=1' ],
			[ 'pageview', 'https://blog.example.com/next', 'https://blog.example.com/next' ]
		]);
	});

	it('tracks the back and forward buttons', async () => {
		var Window = open();
		load(Window, [ [ 'setting', 'track-history', true ] ]);
		Window.history.replaceState({}, '', '/earlier');
		Window.dispatchEvent(new Window.PopStateEvent('popstate'));
		await tick();
		expect(await sent(Window)).toEqual([ [ 'pageview', 'https://blog.example.com/earlier', 'https://blog.example.com/earlier' ] ]);
	});

	it("doesn't track the same URL twice, or hash changes", async () => {
		var Window = open();
		load(Window, [ [ 'setting', 'track-history', true ] ]);
		Window.history.pushState({}, '', '/post?id=1');
		Window.location.hash = '#comments';
		await tick();
		expect(await sent(Window)).toEqual([]);
	});

	it('is off unless turned on', async () => {
		var Window = open();
		load(Window, []);
		Window.history.pushState({}, '', '/next');
		await tick();
		expect(await sent(Window)).toEqual([]);
	});

	it('can be turned off again', async () => {
		var Window = open();
		load(Window, [ [ 'setting', 'track-history', true ], [ 'setting', 'track-history', false ] ]);
		Window.history.pushState({}, '', '/next');
		await tick();
		expect(await sent(Window)).toEqual([]);
	});

	it('still does what pushState does', () => {
		var Window = open();
		load(Window, [ [ 'setting', 'track-history', true ] ]);
		Window.history.pushState({ page: 2 }, '', '/next');
		expect(Window.location.pathname).toBe('/next');
		expect(Window.history.state).toEqual({ page: 2 });
	});
});

describe('track-hash', () => {
	it('tracks hash changes as pages, keeping the hash', async () => {
		var Window = open('https://blog.example.com/app#/home');
		load(Window, [ [ 'setting', 'track-hash', true ], [ 'track', 'pageview' ] ]);
		Window.location.hash = '#/settings';
		await tick();
		await tick();
		expect(await sent(Window)).toEqual([
			[ 'pageview', 'https://blog.example.com/app#/home', 'https://blog.example.com/app#/home' ],
			[ 'pageview', 'https://blog.example.com/app#/settings', 'https://blog.example.com/app#/settings' ]
		]);
	});
});

describe('track-outbound and track-downloads', () => {
	var Links = '<a id="out" href="https://other.example.org/page">Out</a>'
		+ '<a id="nested" href="https://other.example.org/nested"><span>Nested</span></a>'
		+ '<a id="in" href="/about">In</a>'
		+ '<a id="pdf" href="/files/report.pdf?v=2">Report</a>'
		+ '<a id="attribute" href="/export" download>Export</a>'
		+ '<a id="remote-zip" href="https://cdn.example.org/app.zip">App</a>'
		+ '<a id="mail" href="mailto:hello@example.com">Mail</a>';

	it('tracks links to other sites', async () => {
		var Window = open(undefined, Links);
		load(Window, [ [ 'setting', 'track-outbound', true ] ]);
		click(Window, '#out');
		click(Window, '#nested span');
		click(Window, '#in');
		click(Window, '#mail');
		expect(await sent(Window)).toEqual([
			[ 'outbound', 'https://other.example.org/page', 'https://blog.example.com/post?id=1' ],
			[ 'outbound', 'https://other.example.org/nested', 'https://blog.example.com/post?id=1' ]
		]);
	});

	it('tracks middle clicks, which open a new tab, but not right clicks', async () => {
		var Window = open(undefined, Links);
		load(Window, [ [ 'setting', 'track-outbound', true ] ]);
		click(Window, '#out', { type: 'auxclick', button: 1 });
		click(Window, '#out', { type: 'auxclick', button: 2 });
		expect(await sent(Window)).toEqual([ [ 'outbound', 'https://other.example.org/page', 'https://blog.example.com/post?id=1' ] ]);
	});

	it('tracks links to files, wherever they are', async () => {
		var Window = open(undefined, Links);
		load(Window, [ [ 'setting', 'track-downloads', true ] ]);
		click(Window, '#pdf');
		click(Window, '#attribute');
		click(Window, '#remote-zip');
		click(Window, '#out');
		expect(( await sent(Window) ).map(([ Type, Data ]) => [ Type, Data ])).toEqual([
			[ 'download', 'https://blog.example.com/files/report.pdf?v=2' ],
			[ 'download', 'https://blog.example.com/export' ],
			[ 'download', 'https://cdn.example.org/app.zip' ]
		]);
	});

	it('sees clicks the page stops from bubbling', async () => {
		var Window = open(undefined, Links);
		Window.document.querySelector('#out').addEventListener('click', (Event) => Event.stopPropagation());
		load(Window, [ [ 'setting', 'track-outbound', true ] ]);
		click(Window, '#out');
		expect(await sent(Window)).toHaveLength(1);
	});

	it('is off unless turned on', async () => {
		var Window = open(undefined, Links);
		load(Window, []);
		click(Window, '#out');
		click(Window, '#pdf');
		expect(await sent(Window)).toEqual([]);
	});
});

describe('track-404', () => {
	it('tracks a 404 when the page was served as one', async () => {
		var Window = open('https://blog.example.com/missing', '', 404);
		load(Window, [ [ 'setting', 'track-404', true ] ]);
		expect(await sent(Window)).toEqual([ [ '404', 'https://blog.example.com/missing', 'https://blog.example.com/missing' ] ]);
	});

	it("doesn't for other pages, or browsers that don't say", async () => {
		var Window = open(undefined, '', 200);
		load(Window, [ [ 'setting', 'track-404', true ] ]);
		var Unknown = open(undefined, '', 0);
		load(Unknown, [ [ 'setting', 'track-404', true ] ]);
		expect(await sent(Window)).toEqual([]);
		expect(await sent(Unknown)).toEqual([]);
	});

	it('defaults the data of a 404 tracked by hand to the page URL', async () => {
		var Window = open('https://blog.example.com/missing');
		load(Window, [ [ 'track', '404' ] ]);
		expect(await sent(Window)).toEqual([ [ '404', 'https://blog.example.com/missing', 'https://blog.example.com/missing' ] ]);
	});
});

describe('privacy signals', () => {
	it('stop automatic tracking too', async () => {
		var Window = open(undefined, '<a id="out" href="https://other.example.org/">Out</a>');
		Object.defineProperty(Window.navigator, 'globalPrivacyControl', { value: true });
		load(Window, [ [ 'setting', 'track-history', true ], [ 'setting', 'track-outbound', true ] ]);
		Window.history.pushState({}, '', '/next');
		click(Window, '#out');
		await tick();
		expect(await sent(Window)).toEqual([]);
	});
});
