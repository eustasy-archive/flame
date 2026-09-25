////	Page

// The value of a meta tag, or of microdata on an ordinary element.
// https://html.spec.whatwg.org/multipage/microdata.html#values
function itemValue(Element) {
	var Tag, Value;
	Tag = Element.tagName.toLowerCase();
	if ( Element.hasAttribute('content') ) {
		Value = Element.getAttribute('content');
	} else if ( /^(audio|embed|iframe|img|source|track|video)$/.test(Tag) ) {
		Value = Element.src;
	} else if ( /^(a|area|link)$/.test(Tag) ) {
		Value = Element.href;
	} else if ( Tag == 'object' ) {
		Value = Element.data;
	} else {
		Value = Element.textContent;
	}
	return ( Value || '' ).replace(/\s+/g, ' ').trim();
}

// How well an element describes the page: 1 for the page's main item, 2 for any other
// top-level item, or false for microdata that isn't about the page. That's a nested item,
// like an article's author, or a site-wide one, like the publisher in the header.
function itemRank(Element) {
	var Item, Types;
	if ( !Element.hasAttribute('itemprop') ) {
		return 1;
	}
	Item = Element.parentElement && Element.parentElement.closest('[itemscope]');
	if ( !Item ) {
		return 2;
	}
	if ( Item.hasAttribute('itemprop') ) {
		return /(^|\s)mainEntity(\s|$)/.test(Item.getAttribute('itemprop')) ? 1 : false;
	}
	// https://schema.org/Article -> Article
	Types = ( Item.getAttribute('itemtype') || '' ).split(/\s+/).map(function(Type) {
		return Type.split('/').pop();
	});
	if ( Types.some(function(Type) {
		return /Article$|Posting$|Page$|^(CreativeWork|Report|Product|Recipe|Event|Review|Book|Movie|VideoObject|Course|JobPosting|Dataset|SoftwareApplication)$/.test(Type);
	}) ) {
		return 1;
	}
	if ( Types.some(function(Type) {
		return /^(WebSite|Organization|Corporation|NewsMediaOrganization|Brand|SiteNavigationElement|WPHeader|WPFooter|WPSideBar|WPAdBlock|BreadcrumbList)$/.test(Type);
	}) ) {
		return false;
	}
	return 2;
}

// The first non-empty value, trying selectors in order of preference,
// and the best-ranked elements first within each.
function firstValue(Selectors) {
	var Elements, Value;
	for ( var i = 0; i < Selectors.length; i++ ) {
		Elements = document.querySelectorAll(Selectors[i]);
		for ( var Rank = 1; Rank <= 2; Rank++ ) {
			for ( var j = 0; j < Elements.length; j++ ) {
				if ( itemRank(Elements[j]) !== Rank ) {
					continue;
				}
				Value = itemValue(Elements[j]);
				if ( Value ) {
					return Value;
				}
			}
		}
	}
	return '';
}

export function page() {
	return {
		title: firstValue([
			'[property~="og:title"]',
			'[itemprop~="name"]',
			'meta[name="twitter:title"]'
		]) || document.title,
		description: firstValue([
			'meta[name="description"]',
			'[property~="og:description"]',
			'[itemprop~="description"]',
			'meta[name="twitter:description"]'
		]),
		image: firstValue([
			'[property~="og:image"]',
			'[itemprop~="image"]',
			'meta[name="twitter:image"]'
		])
	};
}
