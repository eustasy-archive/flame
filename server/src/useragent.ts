import Bowser from 'bowser';

export type Agent = { browser: string; version: string; engine: string; os: string };

const Unknown: Agent = { browser: '', version: '', engine: '', os: '' };

// The browser, its version and engine, and the OS, from a User-Agent header.
// Windows is named by release ('Windows 10') rather than NT version.
export function userAgent(header: string | null): Agent {
	if (!header) {
		return Unknown;
	}
	let parsed: Bowser.Parser.ParsedResult;
	try {
		parsed = Bowser.parse(header);
	} catch {
		return Unknown;
	}
	const { browser, engine, os } = parsed;
	return {
		browser: browser.name ?? '',
		version: browser.version ?? '',
		engine: engine.name ?? '',
		os: [os.name, os.name === 'Windows' ? os.versionName : os.version].filter(Boolean).join(' '),
	};
}
