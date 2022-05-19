import { defineConfig } from 'vite';
import path from 'path';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill';
import { NodeModulesPolyfillPlugin } from '@esbuild-plugins/node-modules-polyfill';
import rollupNodePolyFill from 'rollup-plugin-node-polyfills'

export default defineConfig({
	plugins: [
		svelte(),
	],
	define: {
		'global': {},
	},
	build: {
		target: 'chrome90',
		sourcemap: true,
		emptyOutDir: false,
		rollupOptions: {
			plugins: [
				rollupNodePolyFill(),
			],
		},
	},
	resolve: {
		alias: {
			'#': path.resolve(__dirname, './src'),
			stream: 'rollup-plugin-node-polyfills/polyfills/stream',
		},
	},
	optimizeDeps: {
		esbuildOptions: {
			define: {
				global: 'globalThis',
			},
			plugins: [
				NodeGlobalsPolyfillPlugin({
					process: true,
					buffer: true,
				}),
				NodeModulesPolyfillPlugin(),
			],
		},
	},
});
