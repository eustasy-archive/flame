// Secrets aren't in wrangler.jsonc, so `wrangler types` doesn't know about them.
// Env is what the Worker's handlers get, and Cloudflare.Env is what
// `import { env } from 'cloudflare:workers'` gives.
interface Secrets {
	// An API token with Account Analytics Read, for the SQL API. Set it with
	// `wrangler secret put CF_API_TOKEN`, or in .dev.vars for `wrangler dev`.
	CF_API_TOKEN: string;
}

interface Env extends Secrets {}

declare namespace Cloudflare {
	interface Env extends Secrets {}
}
