// .sql files are imported as text (see "rules" in wrangler.jsonc).
declare module '*.sql' {
	const sql: string;
	export default sql;
}
