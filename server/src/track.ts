import { allowed, allowedOrigin } from './allowed';
import { parse } from './datapoint';
import { failure } from './respond';

// Bodies are small JSON objects; anything much bigger isn't from the client.
const MaxBytes = 64 * 1024;

// PUT or POST /track: store one pageview or event.
// The client sends JSON as text/plain, to avoid a CORS preflight.
export async function track(request: Request, env: Env): Promise<Response> {
	// Global Privacy Control, or Do Not Track. The client checks these too, but
	// an old copy of it might not, so they're answered as if stored.
	if (request.headers.get('Sec-GPC') === '1' || request.headers.get('DNT') === '1') {
		return new Response(null, { status: 204 });
	}
	if (!allowedOrigin(request, env)) {
		return failure(403, 'This site isn\'t allowed to send data.');
	}
	const text = await request.text();
	if (text.length > MaxBytes) {
		return failure(413, 'The body is too large.');
	}
	let body: unknown;
	try {
		body = JSON.parse(text);
	} catch {
		return failure(400, 'The body must be JSON.');
	}
	const parsed = parse(body, request);
	if ('error' in parsed) {
		return failure(400, parsed.error);
	}
	if (!allowed(parsed.domain, env)) {
		return failure(403, `${parsed.domain} isn't allowed to send data.`);
	}
	env.FLAME.writeDataPoint(parsed.point);
	return new Response(null, { status: 204 });
}
