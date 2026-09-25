// JSON responses in the shape the README documents for the API.
export function json(body: Record<string, unknown>, status = 200, headers: HeadersInit = {}): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
	});
}

export function failure(status: number, error: string, headers: HeadersInit = {}): Response {
	return json({ success: false, warning: false, error }, status, headers);
}

export function notFound(): Response {
	return new Response('Not found', { status: 404 });
}
