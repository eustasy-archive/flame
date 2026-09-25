import { device } from '../flame.device.js';

var Agents = {
	chrome:        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
	iphone:        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
	androidPhone:  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
	androidTablet: 'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
	mac:           'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15'
};

describe('device', () => {
	it.each([
		[ 'iPhone', Agents.iphone, 0, 'phone' ],
		[ 'Android phone', Agents.androidPhone, 0, 'phone' ],
		[ 'Android tablet', Agents.androidTablet, 0, 'tablet' ],
		[ 'iPad (reports as a Mac)', Agents.mac, 5, 'tablet' ],
		[ 'Mac', Agents.mac, 0, false ],
		[ 'Windows', Agents.chrome, 0, false ]
	])('detects %s', (name, agent, touch, expected) => {
		Object.defineProperty(navigator, 'userAgent', { configurable: true, get: () => agent });
		Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, get: () => touch });
		expect(device()).toBe(expected);
	});
});
