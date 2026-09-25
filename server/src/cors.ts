import { allowedOrigin } from './allowed';

// Let pages on allowed sites read a response. Others get no CORS headers, so
// browsers keep the response from them.
export function withCors(request: Request, env: Env, response: Response): Response {
	const origin = request.headers.get('Origin');
	response = new Response(response.body, response);
	response.headers.append('Vary', 'Origin');
	if (origin !== null && allowedOrigin(request, env)) {
		response.headers.set('Access-Control-Allow-Origin', origin);
	}
	return response;
}

// Answer a CORS preflight (OPTIONS) request.
export function preflight(request: Request, env: Env, methods: string[]): Response {
	return withCors(request, env, new Response(null, {
		status: 204,
		headers: {
			'Access-Control-Allow-Methods': methods.join(', '),
			'Access-Control-Allow-Headers': 'Content-Type',
			'Access-Control-Max-Age': '86400',
		},
	}));
}
