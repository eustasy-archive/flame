import { describe, expect, it } from 'vitest';
import pageviewsSql from '../../sql/trending-pageviews.sql';
import totalSql from '../../sql/trending-total.sql';
import valuesSql from '../../sql/trending-values.sql';
import { fill, hex, number } from '../src/analytics';
import { Blobs, Doubles } from '../src/datapoint';

describe('fill', () => {
	it('fills placeholders and drops comments', () => {
		expect(fill('-- A comment\nSELECT {a}\n  -- another\nFROM {b}', { a: 1, b: 'flame' })).toBe('SELECT 1\nFROM flame');
	});

	it("doesn't fill placeholders inside values", () => {
		expect(fill('{a} {b}', { a: '{b}', b: 'x' })).toBe('{b} x');
	});

	it('throws on a missing value', () => {
		expect(() => fill('SELECT {nope}', {})).toThrow('No value for {nope}.');
	});
});

describe('hex', () => {
	it('encodes UTF-8 bytes', () => {
		expect(hex("O'Neil")).toBe('4f274e65696c');
		expect(hex('é')).toBe('c3a9');
		expect(hex('')).toBe('');
	});
});

describe('number', () => {
	it('reads the API\'s numbers', () => {
		expect(number('1203')).toBe(1203);
		expect(number(536.5)).toBe(536.5);
		expect(number(null)).toBe(0);
		expect(number('nan')).toBe(0);
	});
});

// A query line like "argMax(blob5, timestamp) AS title" should use the column
// the layout gives that field. Aggregates named after what they work out
// (count, average) are left out.
describe.each([
	['trending-pageviews.sql', pageviewsSql],
	['trending-values.sql', valuesSql],
	['trending-total.sql', totalSql],
])('sql/%s', (name, sql) => {
	it('reads columns the layout says hold those fields', () => {
		const lines = sql.split('\n').filter((line) => / AS \w+/.test(line) && /\b(blob|double)\d+\b/.test(line));
		expect(lines.length).toBeGreaterThan(0);
		for (const line of lines) {
			const alias = line.match(/ AS (\w+)/)![1];
			if (alias === 'count' || alias === 'average') {
				continue;
			}
			const [, kind, n] = line.match(/\b(blob|double)(\d+)\b/)!;
			const field = (kind === 'blob' ? Blobs : Doubles)[Number(n) - 1];
			expect(`${kind}${n} AS ${alias}`).toBe(`${kind}${n} AS ${field}`);
		}
	});
});
