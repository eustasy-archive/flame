import { page } from '../flame.page.js';

// [ name, [ head, body ], [ title, description, image ] ]
const cases = [
	['og meta tags', ['<meta property="og:title" content="OG title"><meta property="og:description" content="OG desc"><meta property="og:image" content="https://e.com/og.png">'], ['OG title','OG desc','https://e.com/og.png']],
	['name/twitter meta', ['<meta name="description" content="Meta desc"><meta name="twitter:title" content="TW title"><meta name="twitter:image" content="https://e.com/tw.png">'], ['TW title','Meta desc','https://e.com/tw.png']],
	['nothing', [''], ['Doc','','']],
	['microdata on elements', ['', '<article itemscope><h1 itemprop="name">  Micro\n   title </h1><div itemprop="description"><p>Some</p> <p>text</p></div><img itemprop="image" src="/i.png"></article>'], ['Micro title','Some text','https://blog.example.com/i.png']],
	['microdata link/meta', ['<link itemprop="image" href="/l.png"><meta itemprop="name" content="Meta name">'], ['Meta name','','https://blog.example.com/l.png']],
	['empty og:title falls back', ['<meta property="og:title" content="">'], ['Doc','','']],
	['empty itemprop falls back', ['', '<h1 itemprop="name">   </h1>'], ['Doc','','']],
	['nested author name skipped', ['', '<article itemscope><div itemprop="author" itemscope><span itemprop="name">Author</span></div><h1 itemprop="name">Real title</h1></article>'], ['Real title','','']],
	['only nested names: document.title', ['', '<article itemscope><div itemprop="author" itemscope><span itemprop="name">Author</span></div></article>'], ['Doc','','']],
	['form field named description ignored', ['<meta property="og:description" content="OG desc">', '<form><input name="description" value="x"><textarea name="description">typed</textarea></form>'], ['Doc','OG desc','']],
	['empty og:title tries itemprop next', ['<meta property="og:title" content="">', '<h1 itemprop="name">Micro</h1>'], ['Micro','','']],
	['itemprop token list', ['', '<h1 itemprop="headline name">Tokens</h1>'], ['Tokens','','']],
	['second og:image when first empty', ['<meta property="og:image" content=""><meta property="og:image" content="https://e.com/2.png">'], ['Doc','','https://e.com/2.png']],
	['header Organization loses to Article', ['', '<header itemscope itemtype="https://schema.org/Organization"><span itemprop="name">Site Ltd</span><img itemprop="image" src="/logo.png"></header><article itemscope itemtype="https://schema.org/NewsArticle"><h1 itemprop="name">Story</h1><img itemprop="image" src="/story.jpg"></article>'], ['Story','','https://blog.example.com/story.jpg']],
	['Organization only: excluded', ['', '<header itemscope itemtype="http://schema.org/Organization"><span itemprop="name">Site Ltd</span><img itemprop="image" src="/logo.png"></header>'], ['Doc','','']],
	['WebSite only: excluded', ['', '<div itemscope itemtype="https://schema.org/WebSite"><meta itemprop="name" content="Site"></div>'], ['Doc','','']],
	['Organization falls through to twitter:title', ['<meta name="twitter:title" content="TW">', '<header itemscope itemtype="https://schema.org/Organization"><span itemprop="name">Site Ltd</span></header>'], ['TW','','']],
	['mainEntity of WebPage', ['', '<main itemscope itemtype="https://schema.org/WebPage"><div itemprop="mainEntity" itemscope itemtype="https://schema.org/Recipe"><h1 itemprop="name">Soup</h1><div itemprop="author" itemscope itemtype="https://schema.org/Person"><span itemprop="name">Chef</span></div></div></main>'], ['Soup','','']],
	['untyped item beats nothing, loses to Product', ['', '<div itemscope><span itemprop="name">Untyped</span></div><div itemscope itemtype="https://schema.org/Product"><h1 itemprop="name">Widget</h1></div>'], ['Widget','','']],
	['untyped item still used', ['', '<div itemscope><span itemprop="name">Untyped</span></div>'], ['Untyped','','']],
	['WebPage subtype', ['', '<main itemscope itemtype="https://schema.org/ProfilePage"><h1 itemprop="name">Profile</h1></main>'], ['Profile','','']],
	['BlogPosting description', ['', '<div itemscope itemtype="https://schema.org/Organization"><p itemprop="description">We sell things</p></div><article itemscope itemtype="https://schema.org/BlogPosting"><p itemprop="description">Post summary</p></article>'], ['Doc','Post summary','']],
	['RDFa content on span', ['', '<span property="og:title" content="Span title">x</span>'], ['Span title','','']],
];

describe('page', () => {
	beforeEach(() => {
		jsdom.reconfigure({ url: 'https://blog.example.com/post/1' });
	});

	it.each(cases)('%s', (name, [ head, body = '' ], expected) => {
		document.head.innerHTML = '<title>Doc</title>' + head;
		document.body.innerHTML = body;
		var Page = page();
		expect([ Page.title, Page.description, Page.image ]).toEqual(expected);
	});
});

describe('page category', () => {
	beforeEach(() => {
		jsdom.reconfigure({ url: 'https://blog.example.com/post/1' });
	});

	function category(Head, Body = '') {
		document.head.innerHTML = '<title>Doc</title>' + Head;
		document.body.innerHTML = Body;
		return page().category;
	}

	var Ld = (Data) => '<script type="application/ld+json">' + JSON.stringify(Data) + '</script>';

	it.each([
		[ 'Open Graph', '<meta property="article:section" content="Sport">', '', 'Sport' ],
		[ 'microdata', '', '<article itemscope itemtype="https://schema.org/NewsArticle"><meta itemprop="articleSection" content="Politics"></article>', 'Politics' ],
		[ 'JSON-LD', Ld({ '@context': 'https://schema.org', '@type': 'Article', articleSection: 'Science' }), '', 'Science' ],
		[ 'JSON-LD in an @graph', Ld({ '@graph': [ { '@type': 'WebSite', name: 'Blog' }, { '@type': 'Article', articleSection: [ 'Travel', 'Food' ] } ] }), '', 'Travel' ],
		[ 'JSON-LD in a list', Ld([ { '@type': 'BreadcrumbList' }, { '@type': 'BlogPosting', articleSection: ' Long   read ' } ]), '', 'Long read' ],
		[ 'Open Graph before JSON-LD', '<meta property="article:section" content="Sport">' + Ld({ articleSection: 'Science' }), '', 'Sport' ],
		[ 'broken JSON-LD, then good', '<script type="application/ld+json">{nope</script>' + Ld({ articleSection: 'Science' }), '', 'Science' ],
		[ 'a nested item only', Ld({ '@type': 'WebPage', mainEntity: { articleSection: 'Hidden' } }), '', '' ],
		[ 'nothing', '', '', '' ]
	])('reads it from %s', (name, Head, Body, expected) => {
		expect(category(Head, Body)).toBe(expected);
	});
});
