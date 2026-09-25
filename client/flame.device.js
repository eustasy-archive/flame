////	Mobile
// 'phone', 'tablet', or false for anything else.
export function device() {
	var Agent = navigator.userAgent;
	if (
		/iPad|Tablet|Kindle|Silk|PlayBook/i.test(Agent) ||
		( /Android/i.test(Agent) && !/Mobile/i.test(Agent) ) ||
		// iPadOS reports itself as a Mac.
		( /Macintosh/i.test(Agent) && navigator.maxTouchPoints > 1 )
	) {
		return 'tablet';
	}
	if ( /Mobi|iPhone|iPod|Android|Windows Phone|BlackBerry|Opera Mini/i.test(Agent) ) {
		return 'phone';
	}
	return false;
}
