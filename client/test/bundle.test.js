import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Built by `npm run build`, which `npm test` runs first.
var Build = join(import.meta.dirname, '../../server/dist/public');

describe.each([ 'flame.js', 'flame.min.js' ])('%s', (file) => {
	beforeEach(() => {
		localStorage.clear();
	});

	it('runs without adding globals to the page', () => {
		document.head.innerHTML = '<script src="https://flame.example.com/flame.js"></script>';
		navigator.sendBeacon = () => true;
		window.flame = function() {
			( window.flame.q = window.flame.q || [] ).push(arguments);
		};
		window.flame('track');
		var Before = Object.keys(globalThis);
		( 0, eval )( readFileSync(join(Build, file), 'utf8') );
		expect(Object.keys(globalThis)).toEqual(Before);
		expect(localStorage.getItem('flame_session')).toContain('"visits":1');
		delete window.flame;
	});

	it("doesn't register with an AMD loader on the page", () => {
		globalThis.define = vi.fn();
		globalThis.define.amd = {};
		( 0, eval )( readFileSync(join(Build, file), 'utf8') );
		expect(globalThis.define).not.toHaveBeenCalled();
		delete globalThis.define;
	});
});
