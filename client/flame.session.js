////	Session
// Replaces session.js 0.4.1: session, visits, referrer, search engine and mobile detection.
// Location is looked up server-side, and browser plugins are no longer detected.
export function session() {

	var Session_Timeout = 30 * 60 * 1000;           // A session ends after 30 minutes without a pageview.
	var Visitor_Timeout = 32 * 24 * 60 * 60 * 1000; // Visits are counted over 32 days, as session.js did.
	var Storage_Key = 'flame_session';
	var Now = new Date().getTime();

	var Search_Engines = [
		{ name: 'Google',     host: 'google.',        query: 'q'    },
		{ name: 'Bing',       host: 'bing.com',       query: 'q'    },
		{ name: 'Yahoo',      host: 'search.yahoo.',  query: 'p'    },
		{ name: 'DuckDuckGo', host: 'duckduckgo.com', query: 'q'    },
		{ name: 'Yandex',     host: 'yandex.',        query: 'text' },
		{ name: 'Baidu',      host: 'baidu.com',      query: 'wd'   },
		{ name: 'Ecosia',     host: 'ecosia.org',     query: 'q'    },
		{ name: 'AOL',        host: 'search.aol.',    query: 'q'    },
		{ name: 'Ask',        host: 'ask.com',        query: 'q'    }
	];
	// Query parameters that suggest an unlisted search engine.
	var Search_Fallbacks = [ 'q', 'query', 'term', 'p', 'wd', 'text' ];

	function randomId() {
		var Bytes = new Uint8Array(16);
		var Id = '';
		crypto.getRandomValues(Bytes);
		for ( var i = 0; i < Bytes.length; i++ ) {
			Id += ( '0' + Bytes[i].toString(16) ).slice(-2);
		}
		return Id;
	}

	function parseReferrer(Referrer) {
		var Url;
		try {
			Url = new URL(Referrer);
		} catch ( e ) {
			return false;
		}
		return {
			protocol: Url.protocol.replace(':', ''),
			domain:   Url.hostname,
			path:     Url.pathname,
			query:    Url.search.replace('?', ''),
			fragment: Url.hash.replace('#', '')
		};
	}

	function searchFrom(Referrer) {
		var Search = { engine: false, query: false };
		if ( !Referrer || Referrer.domain == location.hostname ) {
			return Search;
		}
		var Query = new URLSearchParams(Referrer.query);
		for ( var i = 0; i < Search_Engines.length; i++ ) {
			if ( Referrer.domain.indexOf(Search_Engines[i].host) !== -1 ) {
				Search.engine = Search_Engines[i].name;
				// Most engines no longer pass the query on, so this is often false.
				Search.query = Query.get(Search_Engines[i].query) || false;
				return Search;
			}
		}
		for ( var j = 0; j < Search_Fallbacks.length; j++ ) {
			if ( Query.get(Search_Fallbacks[j]) ) {
				Search.engine = 'Unknown';
				Search.query = Query.get(Search_Fallbacks[j]);
				return Search;
			}
		}
		return Search;
	}

	function mobile() {
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

	// Storage can be missing or throw (private browsing, blocked site data).
	var Stored = null;
	try {
		Stored = JSON.parse(localStorage.getItem(Storage_Key));
	} catch ( e ) {}
	if ( !Stored || typeof Stored != 'object' ) {
		Stored = {};
	}

	var Visitor = Stored.visitor;
	if ( !Visitor || !( Now - Visitor.last <= Visitor_Timeout ) ) {
		Visitor = { first: Now, last: Now, visits: 0 };
	}

	var Session = Stored.session;
	if ( !Session || !( Now - Session.last <= Session_Timeout ) ) {
		var Referrer = parseReferrer(document.referrer);
		Session = {
			id:        randomId(),
			start:     Now,
			last:      Now,
			pageviews: 0,
			referrer:  Referrer,
			search:    searchFrom(Referrer)
		};
		Visitor.visits++;
	}
	Session.pageviews++;
	Session.last = Now;
	Visitor.last = Now;

	try {
		localStorage.setItem(Storage_Key, JSON.stringify({ visitor: Visitor, session: Session }));
	} catch ( e ) {}

	return {
		id:          Session.id,
		start:       Session.start,
		pageviews:   Session.pageviews,
		visits:      Visitor.visits,
		new_visitor: Visitor.visits == 1,
		referrer:    Session.referrer, // Where the session started from, not this page's referrer.
		search:      Session.search,
		mobile:      mobile()
	};

}
