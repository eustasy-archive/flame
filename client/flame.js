////	Flame
// Entry point for the bundle the Worker serves. esbuild wraps it in a function,
// so nothing here leaks onto the host page.
import platform from './lib.platform.js';
import { cores } from './flame.processor.js';
import { language } from './flame.language.js';
import { page } from './flame.page.js';
import { session } from './flame.session.js';
import { timezone } from './flame.timezone.js';

// Everything collected about this pageview.
function collect() {
	return {
		url:      location.href,
		referrer: document.referrer,
		page:     page(),
		session:  session(),
		browser:  { name: platform.name, version: platform.version, engine: platform.layout },
		os:       String( platform.os ),
		language: language(),
		timezone: timezone(),
		cores:    cores()
	};
}

// Nothing sends this yet: that comes with the command queue.
collect();
