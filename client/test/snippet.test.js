import { readFileSync } from 'node:fs';
import { join } from 'node:path';

var Root = join(import.meta.dirname, '../..');

describe.each([
	'client/flame.inline.js',
	'client/flame.inline.min.js',
	'index.html',
	'index.min.html'
])('%s', (file) => {
	beforeEach(() => {
		document.head.innerHTML = '<script></script>';
		delete window.flm;
		delete window.flame;
	});

	it('loads the bundle and queues calls', () => {
		var Code = readFileSync(join(Root, file), 'utf8').replace(/<\/?script>/g, '');
		vi.spyOn(console, 'log').mockImplementation(() => {});
		( 0, eval )( Code );
		vi.restoreAllMocks();

		var Script = document.head.querySelector('script[src]');
		expect(Script.src).toBe('https://flame.example.com/flame.js?v=1');
		expect(Script.async).toBeTruthy();
		expect(window.flm).toBe('flame');

		var Queued = window.flame.q ? window.flame.q.length : 0;
		window.flame('track', 'pageview');
		expect(window.flame.q.length).toBe(Queued + 1);
		expect(Array.from(window.flame.q[Queued])).toEqual([ 'track', 'pageview' ]);
	});
});
