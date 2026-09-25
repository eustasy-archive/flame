// Secrets aren't in wrangler.jsonc, so `wrangler types` doesn't know about them.
interface Env {
	// An API token with Account Analytics Read, for the SQL API. Set it with
	// `wrangler secret put CF_API_TOKEN`, or in .dev.vars for `wrangler dev`.
	CF_API_TOKEN: string;
}
