////	Screen Resolution & Orientation & Depth & Viewport
export function display() {
	var Orientation = screen.orientation || {};
	return {
		screen: {
			width:  screen.width,
			height: screen.height,
			depth:  screen.colorDepth,
			angle:  Orientation.angle || 0
		},
		viewport: {
			width:  window.innerWidth || document.documentElement.clientWidth,
			height: window.innerHeight || document.documentElement.clientHeight
		}
	};
}
