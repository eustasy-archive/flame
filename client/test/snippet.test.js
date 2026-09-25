import { readFileSync } from 'node:fs';
import { join } from 'node:path';

var Root = join(import.meta.dirname, '../..');
var Minified = readFileSync(join(Root, 'client/snippet.min.js'), 'utf8').trim();
var Readmes = [ 'README.md', 'client/README.md' ];

// Each ```html block in a README that has the snippet in it, as it would be
// copied: without the indentation of a block inside a list.
function pasted(file) {
	var Blocks = Array.from(readFileSync(join(Root, file), 'utf8').matchAll(/^( *)```html\n([\s\S]*?)^\1```/gm));
	return Blocks
		.map(([ , Indent, Block ]) => Block.split('\n').map((Line) => Line.startsWith(Indent) ? Line.slice(Indent.length) : Line).join('\n'))
		.filter((Block) => Block.includes("e['flm']"));
}

describe.each(Readmes)('%s', (file) => {
	it('shows the minified snippet', () => {
		var Blocks = pasted(file);
		expect(Blocks.length).toBeGreaterThan(0);
		for ( var Block of Blocks ) {
			expect(Block).toContain(Minified);
		}
	});
});

describe.each([
	[ 'client/snippet.js', readFileSync(join(Root, 'client/snippet.js'), 'utf8') ],
	[ 'client/snippet.min.js', Minified ],
	...Readmes.flatMap((file) => pasted(file).map((Block) => [ file, Block ]))
])('%s', (file, Code) => {
	beforeEach(() => {
		document.head.innerHTML = '<script></script>';
		delete window.flm;
		delete window.flame;
	});

	it('loads the bundle and queues calls', () => {
		( 0, eval )( Code.replace(/<\/?script>/g, '') );

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
