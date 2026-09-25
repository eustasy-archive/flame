////	Flame
// Entry point for the bundle the Worker serves. esbuild wraps it in a function,
// so nothing here leaks onto the host page.
import { responseStatus, watchHistory, watchLinks } from './flame.auto.js';
import { cores } from './flame.processor.js';
import { device } from './flame.device.js';
import { display } from './flame.display.js';
import { brand } from './flame.hints.js';
import { language } from './flame.language.js';
import { page } from './flame.page.js';
import { timezone } from './flame.timezone.js';

// Where this script was loaded from, which is also where data is sent.
var Server = server();

// Settings for flame('setting', name, value), with their defaults.
var Settings = {
	'honor-privacy-signals': true,
	// Track a pageview each time a single-page app changes the URL.
	'track-history': false,
	// The same, but changes to the hash count as new pages too, for apps that
	// route with it. Pageview URLs then keep their hash.
	'track-hash': false,
	// Track clicks on links to other sites, and to files, as 'outbound' and
	// 'download' events with the link's URL.
	'track-outbound': false,
	'track-downloads': false,
	// Track a '404' event if the page was served as a 404.
	'track-404': false
};

// What to start when a setting is turned on. Each starts once.
var Watchers = {
	'track-history': watchPages,
	'track-hash': watchPages,
	'track-outbound': watchClicks,
	'track-downloads': watchClicks,
	'track-404': check404
};

// Commands for flame('command', …).
var Commands = {
	setting: function(Name, Value) {
		if ( !Settings.hasOwnProperty(Name) ) {
			warn('Flame doesn\'t know the setting "' + Name + '".');
			return;
		}
		Settings[Name] = Value;
		if ( Value && Watchers[Name] ) {
			Watchers[Name]();
		}
	},
	track: track,
	trending: trending
};

function server() {
	// currentScript is only set while this script first runs.
	var Script = document.currentScript || document.querySelector('script[src*="/flame.js"]');
	try {
		return new URL(Script.src).origin;
	} catch ( e ) {
		warn('Flame couldn\'t tell where it was loaded from, so it won\'t send anything.');
		return false;
	}
}

function warn(Message) {
	if ( window.console && console.warn ) {
		console.warn(Message);
	}
}

// Global Privacy Control, or Do Not Track, which it replaces.
function optedOut() {
	return navigator.globalPrivacyControl === true || navigator.doNotTrack === '1' || window.doNotTrack === '1';
}

// Run Start the first time it's asked for by Name.
var Started = {};
function once(Name, Start) {
	if ( !Started[Name] ) {
		Started[Name] = true;
		Start();
	}
}

// This page's URL, without its hash unless the hash is part of the route.
function pageUrl() {
	return Settings['track-hash'] ? location.href : location.href.split('#')[0];
}

var Last_Page;
function watchPages() {
	once('pages', function() {
		Last_Page = pageUrl();
		watchHistory(function() {
			// Wait for the app to update the page, such as its title.
			setTimeout(function() {
				if ( ( Settings['track-history'] || Settings['track-hash'] ) && pageUrl() != Last_Page ) {
					Last_Page = pageUrl();
					track('pageview');
				}
			}, 0);
		});
	});
}

function watchClicks() {
	once('clicks', function() {
		watchLinks(function(Type, Url) {
			if ( Settings[Type == 'download' ? 'track-downloads' : 'track-outbound'] ) {
				track(Type, Url);
			}
		});
	});
}

function check404() {
	once('404', function() {
		if ( responseStatus() == 404 ) {
			track('404');
		}
	});
}

// Everything collected about this pageview.
function collect() {
	var Display = display();
	var Page = page();
	var Brand = brand();
	return {
		url:         pageUrl(),
		referrer:    document.referrer,
		title:       Page.title,
		description: Page.description,
		image:       Page.image,
		// Only when User-Agent Client Hints name it. Otherwise the server reads
		// the browser, its engine and the OS from the User-Agent header.
		browser:  Brand,
		mobile:   device(),
		screen:   Display.screen,
		viewport: Display.viewport,
		language: language(),
		timezone: timezone(),
		cores:    cores()
	};
}

// flame('track', type, data, category)
// Pageviews and 404s default their data to the page's URL. Payments and subscriptions
// take an amount as their data, as an integer (e.g. pence) rather than a float.
function track(Type, Data, Category) {
	var Payload;
	// Checked before anything is collected or stored.
	if ( Settings['honor-privacy-signals'] && optedOut() ) {
		return;
	}
	Payload = collect();
	Payload.type = String( Type || 'pageview' );
	if ( Data === undefined || Data === null ) {
		Data = ( Payload.type == 'pageview' || Payload.type == '404' ) ? Payload.url : '';
	}
	Payload.data = String( Data );
	Payload.category = Category ? String( Category ) : '';
	Payload.value = ( Payload.type == 'payment' || Payload.type == 'subscription' ) ? ( Number( Data ) || 0 ) : 0;
	send('/track', Payload);
}

// flame('trending', options, callback)
// Options are /trending's parameters: type, domain (this page's by default),
// count, range, category and terms (a list of words). The callback gets the
// parsed response, or { success: false, error: '…' } if it couldn't be fetched.
function trending(Options, Callback) {
	var Parameters = { domain: location.hostname };
	var Name;
	Options = Options || {};
	for ( Name in Options ) {
		if ( Options.hasOwnProperty(Name) ) {
			Parameters[Name] = Name == 'terms' ? JSON.stringify(Options[Name]) : Options[Name];
		}
	}
	Parameters.format = 'json';
	Callback = Callback || function() {};
	if ( !Server || !window.fetch ) {
		Callback({ success: false, warning: false, error: 'Flame couldn\'t fetch trending data.' });
		return;
	}
	fetch(Server + '/trending?' + new URLSearchParams(Parameters), { credentials: 'omit' })
		.then(function(Response) {
			return Response.json();
		})
		.then(Callback, function() {
			Callback({ success: false, warning: false, error: 'Flame couldn\'t fetch trending data.' });
		});
}

function send(Path, Payload) {
	var Body = JSON.stringify(Payload);
	if ( !Server ) {
		return;
	}
	// Sent as text/plain, so it's a simple request that needs no CORS preflight.
	if ( navigator.sendBeacon && navigator.sendBeacon(Server + Path, new Blob([ Body ], { type: 'text/plain' })) ) {
		return;
	}
	if ( window.fetch ) {
		fetch(Server + Path, { method: 'POST', body: Body, keepalive: true, mode: 'no-cors', credentials: 'omit' })['catch'](function() {});
	}
}

// Run one flame(…) call. Mistakes are logged, never thrown at the host page.
function run(Args) {
	var Command = Commands[Args[0]];
	if ( !Command ) {
		warn('Flame doesn\'t know the command "' + Args[0] + '".');
		return;
	}
	try {
		Command.apply(null, Array.prototype.slice.call(Args, 1));
	} catch ( e ) {
		warn(e);
	}
}

// The snippet queued calls on window[window.flm] until now. Replace it with a
// function that runs them straight away, then run what was queued.
var Name = window.flm || 'flame';
var Queue = ( window[Name] && window[Name].q ) || [];
window[Name] = function() {
	run(arguments);
};
for ( var i = 0; i < Queue.length; i++ ) {
	run(Queue[i]);
}
