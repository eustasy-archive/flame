import { preflight, withCors } from './cors';
import { notFound } from './respond';
import { track } from './track';
import { trending } from './trending';

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);
		switch (url.pathname) {
			case '/flame.js':
				return only(request, ['GET', 'HEAD']) ?? script(request, env, url);
			case '/track':
				if (request.method === 'OPTIONS') {
					return preflight(request, env, ['PUT', 'POST']);
				}
				return withCors(request, env, only(request, ['PUT', 'POST']) ?? (await track(request, env)));
			case '/trending':
				if (request.method === 'OPTIONS') {
					return preflight(request, env, ['GET']);
				}
				return withCors(request, env, only(request, ['GET']) ?? (await trending(request, env, ctx)));
		}
		return notFound();
	},
} satisfies ExportedHandler<Env>;

// A 405 if the request's method isn't one of these.
function only(request: Request, methods: string[]): Response | undefined {
	if (!methods.includes(request.method)) {
		return new Response('Method not allowed', { status: 405, headers: { Allow: methods.join(', ') } });
	}
}

// The client bundle: minified, or readable with ?verbose.
async function script(request: Request, env: Env, url: URL): Promise<Response> {
	const file = url.searchParams.has('verbose') ? '/flame.js' : '/flame.min.js';
	const asset = await env.ASSETS.fetch(new Request(new URL(file, url), request));
	const response = new Response(asset.body, asset);
	response.headers.set('Content-Type', 'text/javascript; charset=utf-8');
	response.headers.set('Cache-Control', 'public, max-age=3600');
	return response;
}
