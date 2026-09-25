import { parse } from './datapoint';
import { failure } from './respond';

// Bodies are small JSON objects; anything much bigger isn't from the client.
const MaxBytes = 64 * 1024;

// PUT or POST /track: store one pageview or event.
// The client sends JSON as text/plain, to avoid a CORS preflight.
export async function track(request: Request, env: Env): Promise<Response> {
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
	env.FLAME.writeDataPoint(parsed.point);
	return new Response(null, { status: 204 });
}
