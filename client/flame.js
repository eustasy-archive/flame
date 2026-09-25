////	Flame
// Entry point for the bundle the Worker serves. esbuild wraps it in a function,
// so nothing here leaks onto the host page.
import { cores } from './flame.processor.js';
import { device } from './flame.device.js';
import { display } from './flame.display.js';
import { brand } from './flame.hints.js';
import { language } from './flame.language.js';
import { page } from './flame.page.js';
import { session } from './flame.session.js';
import { timezone } from './flame.timezone.js';

// Where this script was loaded from, which is also where data is sent.
var Server = server();

// Settings for flame('setting', name, value), with their defaults.
var Settings = {
	'honor-privacy-signals': true,
	// The session ID is kept in localStorage. Sites that need consent for that
	// (in the EU, generally) can turn it off until they have it.
	'session': true
};

// Commands for flame('command', …).
var Commands = {
	setting: function(Name, Value) {
		if ( !Settings.hasOwnProperty(Name) ) {
			warn('Flame doesn\'t know the setting "' + Name + '".');
			return;
		}
		Settings[Name] = Value;
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

// The session only counts one pageview per page load, however often it's read.
var Current_Session = null;
function currentSession() {
	if ( !Current_Session ) {
		Current_Session = session();
	}
	return Current_Session;
}

// Everything collected about this pageview.
function collect() {
	var Display = display();
	var Page = page();
	var Session = Settings.session ? currentSession() : false;
	var Brand = brand();
	return {
		url:         location.href.split('#')[0],
		referrer:    document.referrer,
		title:       Page.title,
		description: Page.description,
		image:       Page.image,
		session: Session && {
			id:          Session.id,
			visits:      Session.visits,
			pageviews:   Session.pageviews,
			new_visitor: Session.new_visitor,
			search:      Session.search
		},
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
// Pageviews default their data to the page's URL. Payments and subscriptions
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
		Data = Payload.type == 'pageview' ? Payload.url : '';
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
