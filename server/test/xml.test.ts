import { describe, expect, it } from 'vitest';
import { xml } from '../src/xml';

describe('xml', () => {
	it("drops characters XML can't hold, and escapes the rest", () => {
		expect(xml({ error: 'a\u0000b\u001Fc "d" \'e\'' })).toContain('<error>abc &quot;d&quot; &apos;e&apos;</error>');
	});

	it('escapes category names', () => {
		expect(xml({ results: { 'A "B" & <C>': { count: 1 } } })).toContain('<category name="A &quot;B&quot; &amp; &lt;C&gt;">');
	});
});
