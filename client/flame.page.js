////	Page

// The value of a meta tag, or of microdata on an ordinary element.
// https://html.spec.whatwg.org/multipage/microdata.html#values
function flame_page_value(Element) {
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

// Microdata on a nested item, like an article's author, isn't about the page.
function flame_page_nested(Element) {
	var Item = Element.parentElement && Element.parentElement.closest('[itemscope]');
	return Element.hasAttribute('itemprop') && Item && Item.hasAttribute('itemprop');
}

// The first non-empty value, trying selectors in order of preference.
function flame_page_first(Selectors) {
	var Elements, Value;
	for ( var i = 0; i < Selectors.length; i++ ) {
		Elements = document.querySelectorAll(Selectors[i]);
		for ( var j = 0; j < Elements.length; j++ ) {
			if ( flame_page_nested(Elements[j]) ) {
				continue;
			}
			Value = flame_page_value(Elements[j]);
			if ( Value ) {
				return Value;
			}
		}
	}
	return '';
}

// Title
flame_page_title = flame_page_first([
	'[property~="og:title"]',
	'[itemprop~="name"]',
	'meta[name="twitter:title"]'
]) || document.title;

// Description
flame_page_description = flame_page_first([
	'meta[name="description"]',
	'[property~="og:description"]',
	'[itemprop~="description"]',
	'meta[name="twitter:description"]'
]);

// Image
flame_page_image = flame_page_first([
	'[property~="og:image"]',
	'[itemprop~="image"]',
	'meta[name="twitter:image"]'
]);
