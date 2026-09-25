// /trending's response as XML, for format=xml. Pages are <result> elements.
// Results keyed by category are <category name="…"> elements, since categories
// like "OS X" or "__ALL__" can't be element names. For payments and
// subscriptions, each holds its totals; for pageviews, <result> elements.
export function xml(body: Record<string, unknown>): string {
	return `<?xml version="1.0" encoding="UTF-8"?>\n<response>\n${children(body, 1)}</response>\n`;
}

function children(object: Record<string, unknown>, depth: number): string {
	return Object.entries(object)
		.map(([name, value]) => (name === 'results' ? results(value, depth) : element(name, value, depth)))
		.join('');
}

function results(value: unknown, depth: number): string {
	const tab = '\t'.repeat(depth);
	return `${tab}<results>\n${items(value, depth + 1)}${tab}</results>\n`;
}

function items(value: unknown, depth: number): string {
	const tab = '\t'.repeat(depth);
	if (Array.isArray(value)) {
		return value.map((result) => `${tab}<result>\n${children(result, depth + 1)}${tab}</result>\n`).join('');
	}
	return Object.entries(value as Record<string, unknown>)
		.map(([category, result]) => {
			const inside = Array.isArray(result) ? items(result, depth + 1) : children(result as Record<string, unknown>, depth + 1);
			return `${tab}<category name="${escape(category)}">\n${inside}${tab}</category>\n`;
		})
		.join('');
}

function element(name: string, value: unknown, depth: number): string {
	return `${'\t'.repeat(depth)}<${name}>${escape(String(value))}</${name}>\n`;
}

function escape(text: string): string {
	return (
		text
			// Characters XML 1.0 can't hold at all.
			.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&apos;')
	);
}
