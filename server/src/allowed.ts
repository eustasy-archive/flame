// Whether a hostname is in ALLOWED_DOMAINS.
export function allowed(hostname: string, env: Env): boolean {
	hostname = hostname.toLowerCase();
	return String(env.ALLOWED_DOMAINS)
		.split(',')
		.map((domain) => domain.trim().toLowerCase())
		.some((domain) => {
			if (domain.startsWith('*.')) {
				return hostname.endsWith(domain.slice(1));
			}
			return domain !== '' && hostname === domain;
		});
}

// Whether a request's Origin header, if it has one, is allowed. Browsers set it
// on cross-site requests, so this stops other sites' pages using the API.
// Anything else can send any Origin it likes, so this is no protection there.
export function allowedOrigin(request: Request, env: Env): boolean {
	const origin = request.headers.get('Origin');
	if (origin === null) {
		return true;
	}
	try {
		return allowed(new URL(origin).hostname, env);
	} catch {
		return false;
	}
}
