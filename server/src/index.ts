export default {
	async fetch(): Promise<Response> {
		return notFound();
	},
} satisfies ExportedHandler<Env>;

function notFound(): Response {
	return new Response('Not found', { status: 404 });
}
