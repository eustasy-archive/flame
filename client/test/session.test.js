import { session } from '../flame.session.js';

// Load a page and start the session script on it.
function visit({ url = 'https://blog.example.com/post', referrer = '' } = {}) {
	jsdom.reconfigure({ url: url });
	Object.defineProperty(document, 'referrer', { configurable: true, get: () => referrer });
	return session();
}

// Move the stored session and visitor back in time.
function age(Session_Ms, Visitor_Ms) {
	var Stored = JSON.parse(localStorage.getItem('flame_session'));
	Stored.session.last -= Session_Ms;
	Stored.visitor.last -= Visitor_Ms;
	localStorage.setItem('flame_session', JSON.stringify(Stored));
}

describe('session', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it('starts a session from a search engine', () => {
		var Session = visit({ referrer: 'https://www.bing.com/search?q=fire+extinguisher&form=QBLH' });
		expect(Session.id).toMatch(/^[0-9a-f]{32}$/);
		expect(Session).toMatchObject({ visits: 1, pageviews: 1, new_visitor: true });
		expect(Session.search).toEqual({ engine: 'Bing', query: 'fire extinguisher' });
		expect(Session.referrer).toEqual({ protocol: 'https', domain: 'www.bing.com', path: '/search', query: 'q=fire+extinguisher&form=QBLH', fragment: '' });
	});

	it('keeps the session, entry referrer and search across pageviews', () => {
		var First = visit({ referrer: 'https://www.bing.com/search?q=hose' });
		var Second = visit({ referrer: 'https://blog.example.com/post' });
		expect(Second.id).toBe(First.id);
		expect(Second).toMatchObject({ pageviews: 2, visits: 1 });
		expect(Second.search).toEqual(First.search);
	});

	it('starts a new visit after 30 minutes idle', () => {
		var First = visit();
		age(31 * 60 * 1000, 0);
		var Second = visit();
		expect(Second.id).not.toBe(First.id);
		expect(Second).toMatchObject({ visits: 2, pageviews: 1, new_visitor: false });
	});

	it('forgets the visitor after 32 days', () => {
		visit();
		age(33 * 86400000, 33 * 86400000);
		expect(visit()).toMatchObject({ visits: 1, new_visitor: true });
	});

	it('ignores corrupt storage', () => {
		localStorage.setItem('flame_session', '{not json');
		expect(visit().visits).toBe(1);
		localStorage.setItem('flame_session', 'null');
		expect(visit().visits).toBe(1);
	});

	it('works when storage throws', () => {
		var Spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('SecurityError'); });
		vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('SecurityError'); });
		expect(visit()).toMatchObject({ visits: 1, pageviews: 1 });
		expect(Spy).toHaveBeenCalled();
		vi.restoreAllMocks();
	});

	it.each([
		[ 'Google with no query', 'https://www.google.co.uk/', { engine: 'Google', query: false } ],
		[ 'an unlisted engine', 'https://search.example.org/results?query=hose', { engine: 'Unknown', query: 'hose' } ],
		[ 'a same-site referrer', 'https://blog.example.com/search?q=hose', { engine: false, query: false } ],
		[ 'no referrer', '', { engine: false, query: false } ]
	])('reads search from %s', (name, referrer, expected) => {
		expect(visit({ referrer: referrer }).search).toEqual(expected);
	});
});
