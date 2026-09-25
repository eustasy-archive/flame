// /trending's response as XML, for format=xml. Pageview results are <result>
// elements. Payment and subscription results, which are keyed by category,
// are <category name="…"> elements, since categories like "OS X" or
// "__ALL__" can't be element names.
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
	const items = Array.isArray(value)
		? value.map((result) => `${tab}\t<result>\n${children(result, depth + 2)}${tab}\t</result>\n`)
		: Object.entries(value as Record<string, Record<string, unknown>>).map(
				([category, result]) => `${tab}\t<category name="${escape(category)}">\n${children(result, depth + 2)}${tab}\t</category>\n`,
			);
	return `${tab}<results>\n${items.join('')}${tab}</results>\n`;
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
