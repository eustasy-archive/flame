////	User-Agent Client Hints
// Chromium browsers freeze most of their user-agent string, but still say which
// browser they are here, so Brave or Edge aren't mistaken for Chrome. Only the
// low-entropy values are read: nothing that needs asking for.
export function brand() {
	var Brands = navigator.userAgentData && navigator.userAgentData.brands;
	if ( !Brands || !Brands.length ) {
		return false;
	}
	// Leave out "Chromium", which every Chromium browser lists, and made-up
	// "GREASE" brands like "Not)A;Brand", which are there to catch naive parsers.
	var Named = Brands.filter(function(Brand) {
		return Brand.brand != 'Chromium' && !/not.?a.?brand/i.test(Brand.brand);
	});
	var Brand = Named[0] || Brands.filter(function(Brand) {
		return Brand.brand == 'Chromium';
	})[0];
	if ( !Brand ) {
		return false;
	}
	return {
		name:    Brand.brand.replace(/^Google /, ''),
		version: Brand.version
	};
}
