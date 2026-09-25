import { describe, expect, it } from 'vitest';
import { search } from '../src/search';

const page = new URL('https://blog.example.com/post');

describe('search', () => {
	it.each([
		['Bing', 'https://www.bing.com/search?q=fire+extinguisher&form=QBLH', { engine: 'Bing', query: 'fire extinguisher' }],
		['Google, which passes no query', 'https://www.google.co.uk/', { engine: 'Google', query: '' }],
		['Yandex', 'https://yandex.ru/search/?text=hose', { engine: 'Yandex', query: 'hose' }],
		['an unlisted engine', 'https://search.example.org/results?query=hose', { engine: 'Unknown', query: 'hose' }],
		['a link from another site', 'https://news.example.org/story', { engine: '', query: '' }],
		['a same-site referrer', 'https://blog.example.com/search?q=hose', { engine: '', query: '' }],
		['no referrer', '', { engine: '', query: '' }],
		['a non-web referrer', 'android-app://com.google.android.gm/', { engine: '', query: '' }],
		['something else', { nope: true }, { engine: '', query: '' }],
	])('reads %s', (name, referrer, expected) => {
		expect(search(referrer, page)).toEqual(expected);
	});
});
