////	Page

// Title
flame_page_title = (
	document.getElementsByAttribute('property', 'og:title'      )[0] ||
	document.getElementsByAttribute('itemprop', 'name'          )[0] ||
	document.getElementsByName(                 'twitter:title' )[0]
);
if ( flame_page_title ) {
	flame_page_title = flame_page_title.getAttribute('content');
} else {
	flame_page_title = document.title;
}

// Description
flame_page_description = (
	document.getElementsByName(                 'description'         )[0] ||
	document.getElementsByAttribute('property', 'og:description'      )[0] ||
	document.getElementsByAttribute('itemprop', 'description'         )[0] ||
	document.getElementsByName(                 'twitter:description' )[0]
);
if ( flame_page_description ) {
	flame_page_description.getAttribute('content');
} else {
	flame_page_description = '';
}

// Image
flame_page_image = (
	document.getElementsByAttribute('property', 'og:image'      )[0] ||
	document.getElementsByAttribute('itemprop', 'image'         )[0] ||
	document.getElementsByName(                 'twitter:image' )[0]
);
if ( flame_page_image ) {
	flame_page_image.getAttribute('content');
} else {
	flame_page_image = '';
}
