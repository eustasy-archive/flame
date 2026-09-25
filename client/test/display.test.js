import { display } from '../flame.display.js';

describe('display', () => {
	it('reads the screen and viewport', () => {
		vi.spyOn(screen, 'width', 'get').mockReturnValue(2560);
		vi.spyOn(screen, 'height', 'get').mockReturnValue(1440);
		vi.spyOn(screen, 'colorDepth', 'get').mockReturnValue(30);
		Object.defineProperty(screen, 'orientation', { configurable: true, value: { type: 'landscape-primary', angle: 90 } });
		window.innerWidth = 1280;
		window.innerHeight = 720;
		expect(display()).toEqual({
			screen: { width: 2560, height: 1440, depth: 30, angle: 90 },
			viewport: { width: 1280, height: 720 }
		});
		vi.restoreAllMocks();
		delete screen.orientation;
	});

	it('copes without screen.orientation', () => {
		expect(display().screen.angle).toBe(0);
	});
});
