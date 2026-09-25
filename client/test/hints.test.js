import { brand } from '../flame.hints.js';

function hints(Brands) {
	Object.defineProperty(navigator, 'userAgentData', { configurable: true, value: Brands && { brands: Brands, mobile: false, platform: 'Windows' } });
}

describe('brand', () => {
	afterEach(() => {
		delete navigator.userAgentData;
	});

	it.each([
		[ 'Chrome', [ { brand: 'Not)A;Brand', version: '8' }, { brand: 'Chromium', version: '140' }, { brand: 'Google Chrome', version: '140' } ], { name: 'Chrome', version: '140' } ],
		[ 'Edge', [ { brand: 'Microsoft Edge', version: '140' }, { brand: 'Not_A Brand', version: '24' }, { brand: 'Chromium', version: '140' } ], { name: 'Microsoft Edge', version: '140' } ],
		[ 'Brave', [ { brand: 'Chromium', version: '140' }, { brand: 'Brave', version: '140' }, { brand: 'Not/A)Brand', version: '99' } ], { name: 'Brave', version: '140' } ],
		[ 'plain Chromium', [ { brand: 'Chromium', version: '140' }, { brand: 'Not.A/Brand', version: '8' } ], { name: 'Chromium', version: '140' } ],
		[ 'only GREASE', [ { brand: 'Not A(Brand', version: '99' } ], false ],
		[ 'no brands', [], false ]
	])('reads %s', (name, Brands, expected) => {
		hints(Brands);
		expect(brand()).toEqual(expected);
	});

	it('is false without Client Hints, as in Firefox and Safari', () => {
		expect(brand()).toBe(false);
	});
});
