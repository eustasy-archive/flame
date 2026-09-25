////	Automatic Tracking
// Watchers that flame.js starts when their settings are turned on. Each calls
// back when there's something to track.

// Files that count as downloads, by extension.
var Downloads = /\.(7z|avi|csv|dmg|docx?|epub|exe|gz|iso|key|midi?|mov|mp3|mp4|mpe?g|msi|pdf|pkg|pps|pptx?|rar|rtf|tar|txt|wav|wma|wmv|xlsx?|zip)$/i;

// Single-page apps change the URL with history.pushState. The back and forward
// buttons fire popstate, and apps that route with the hash fire hashchange.
export function watchHistory(Changed) {
	var Push = history.pushState;
	history.pushState = function() {
		var Result = Push.apply(this, arguments);
		Changed();
		return Result;
	};
	window.addEventListener('popstate', Changed);
	window.addEventListener('hashchange', Changed);
}

// Clicks on links to files, or to other sites, as ('download' or 'outbound', URL).
// Middle clicks count, since they open the link in a new tab. Clicks are caught
// on the way down, so a page stopping them from bubbling doesn't hide them.
export function watchLinks(Clicked) {
	function clicked(Event) {
		var Link, Url;
		if ( Event.type == 'auxclick' && Event.button != 1 ) {
			return;
		}
		Link = Event.target && Event.target.closest && Event.target.closest('a[href]');
		if ( !Link ) {
			return;
		}
		try {
			Url = new URL(Link.href, location.href);
		} catch ( e ) {
			return;
		}
		if ( Url.protocol != 'http:' && Url.protocol != 'https:' ) {
			return;
		}
		if ( Link.hasAttribute('download') || Downloads.test(Url.pathname) ) {
			Clicked('download', Url.href);
		} else if ( Url.hostname != location.hostname ) {
			Clicked('outbound', Url.href);
		}
	}
	document.addEventListener('click', clicked, true);
	document.addEventListener('auxclick', clicked, true);
}

// The page's HTTP status, from Navigation Timing, or 0 where the browser doesn't
// say. Chromium and Firefox do.
export function responseStatus() {
	var Navigation = window.performance && performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
	return ( Navigation && Navigation.responseStatus ) || 0;
}
