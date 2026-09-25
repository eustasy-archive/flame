////	Language
// The server falls back to the Accept-Language header.
export function language() {
	return navigator.languages ? navigator.languages[0] : ( navigator.userLanguage || navigator.systemLanguage || navigator.browserLanguage || navigator.language || false );
}
