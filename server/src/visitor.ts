// Cookie-free visitor IDs, counted the way Plausible does: a hash of a daily
// salt, the site's domain, and the visitor's IP address and user agent. Nothing
// is stored in the browser, and the IP address and user agent aren't stored.
//
// Each UTC day gets a random salt, kept in the SALTS KV namespace until the day
// is over, when KV deletes it. After that, nobody can work out which IP address
// and user agent an ID came from, or link it to the same visitor on another day.

// Salts are kept an hour past their day, for requests still in flight.
const GraceSeconds = 60 * 60;

// How long an isolate keeps its copy of the salt before reading KV again.
const RememberMs = 5 * 60 * 1000;

let remembered: { day: string; salt: string; until: number } | undefined;

// A 32-character hex ID for this visitor to this domain, today.
export async function visitor(request: Request, env: Env, domain: string): Promise<string> {
	const salt = await dailySalt(env);
	const ip = request.headers.get('CF-Connecting-IP') ?? '';
	const agent = request.headers.get('User-Agent') ?? '';
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode([salt, domain, ip, agent].join('\n')));
	return toHex(digest).slice(0, 32);
}

async function dailySalt(env: Env): Promise<string> {
	const now = new Date();
	const day = now.toISOString().slice(0, 10);
	if (remembered?.day === day && remembered.until > now.getTime()) {
		return remembered.salt;
	}
	const key = `salt:${day}`;
	let salt = await env.SALTS.get(key);
	if (!salt) {
		// Two data centers can both get here early in the day, and KV keeps the
		// last write, so for a minute or so a visitor may get two IDs. Isolates
		// read KV again every few minutes, so they settle on the same salt.
		salt = toHex(crypto.getRandomValues(new Uint8Array(32)));
		const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1) / 1000;
		await env.SALTS.put(key, salt, { expiration: midnight + GraceSeconds });
	}
	remembered = { day, salt, until: now.getTime() + RememberMs };
	return salt;
}

// For tests: forget this isolate's copy of the salt.
export function forgetSalt(): void {
	remembered = undefined;
}

function toHex(bytes: ArrayBuffer | Uint8Array): string {
	return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
