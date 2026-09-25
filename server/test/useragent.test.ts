import { describe, expect, it } from 'vitest';
import { userAgent } from '../src/useragent';

describe('userAgent', () => {
	it.each([
		['Chrome on Windows', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36', { browser: 'Chrome', version: '140.0.0.0', engine: 'Blink', os: 'Windows 10' }],
		['Edge on Windows', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0', { browser: 'Microsoft Edge', version: '140.0.0.0', engine: 'Blink', os: 'Windows 10' }],
		['Safari on iPhone', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1', { browser: 'Safari', version: '18.5', engine: 'WebKit', os: 'iOS 18.5' }],
		['Safari on a Mac', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15', { browser: 'Safari', version: '18.5', engine: 'WebKit', os: 'macOS 10.15.7' }],
		['Chrome on Android', 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36', { browser: 'Chrome', version: '140.0.0.0', engine: 'Blink', os: 'Android 14' }],
		['Firefox on Linux', 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:142.0) Gecko/20100101 Firefox/142.0', { browser: 'Firefox', version: '142.0', engine: 'Gecko', os: 'Linux' }],
	])('reads %s', (name, header, expected) => {
		expect(userAgent(header)).toEqual(expected);
	});

	it.each([[null], ['']])('copes with %j', (header) => {
		expect(userAgent(header)).toEqual({ browser: '', version: '', engine: '', os: '' });
	});
});
