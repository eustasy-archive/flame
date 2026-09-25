import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		projects: [
			{
				plugins: [
					cloudflareTest({
						wrangler: { configPath: './wrangler.jsonc' },
					}),
				],
				test: {
					name: 'server',
					include: ['test/**/*.test.ts'],
				},
			},
			{
				// The client has no package.json of its own, so its tests use Vitest's
				// globals rather than importing from 'vitest'.
				root: '..',
				// Vite only serves files under a package.json's folder by default.
				server: { fs: { strict: false } },
				test: {
					name: 'client',
					include: ['client/test/**/*.test.js'],
					setupFiles: ['client/test/setup.js'],
					environment: 'jsdom',
					globals: true,
				},
			},
		],
	},
});
