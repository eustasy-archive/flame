export default {
	async fetch(request, env): Promise<Response> {
		const url = new URL(request.url);
		if (url.pathname === '/flame.js' && (request.method === 'GET' || request.method === 'HEAD')) {
			return script(request, env, url);
		}
		return notFound();
	},
} satisfies ExportedHandler<Env>;

// The client bundle: minified, or readable with ?verbose.
async function script(request: Request, env: Env, url: URL): Promise<Response> {
	const file = url.searchParams.has('verbose') ? '/flame.js' : '/flame.min.js';
	const asset = await env.ASSETS.fetch(new Request(new URL(file, url), request));
	const response = new Response(asset.body, asset);
	response.headers.set('Content-Type', 'text/javascript; charset=utf-8');
	response.headers.set('Cache-Control', 'public, max-age=3600');
	return response;
}

function notFound(): Response {
	return new Response('Not found', { status: 404 });
}
