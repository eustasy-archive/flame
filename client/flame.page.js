////	Page

// The value of a meta tag, or of microdata on an ordinary element.
// https://html.spec.whatwg.org/multipage/microdata.html#values
function flame_page_value(Element) {
	var Tag, Value;
	if ( !Element ) {
		return '';
	}
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

// Title
flame_page_title = flame_page_value(
	document.getElementsByAttribute('property', 'og:title'      )[0] ||
	document.getElementsByAttribute('itemprop', 'name'          )[0] ||
	document.getElementsByName(                 'twitter:title' )[0]
) || document.title;

// Description
flame_page_description = flame_page_value(
	document.getElementsByName(                 'description'         )[0] ||
	document.getElementsByAttribute('property', 'og:description'      )[0] ||
	document.getElementsByAttribute('itemprop', 'description'         )[0] ||
	document.getElementsByName(                 'twitter:description' )[0]
);

// Image
flame_page_image = flame_page_value(
	document.getElementsByAttribute('property', 'og:image'      )[0] ||
	document.getElementsByAttribute('itemprop', 'image'         )[0] ||
	document.getElementsByName(                 'twitter:image' )[0]
);
