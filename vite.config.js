import { defineConfig, loadEnv } from 'vite';
import path from 'path';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill';
import { NodeModulesPolyfillPlugin } from '@esbuild-plugins/node-modules-polyfill';
import rollupNodePolyFill from 'rollup-plugin-node-polyfills'

export default defineConfig(({mode}) => {
	const h_env = loadEnv(mode, process.cwd());
	return {
		plugins: [
			svelte(),
		],
		define: {
			'global': {},
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
		server: {
			proxy: {
				'^/sparql': {
					target: h_env.VITE_SPARQL_ENDPOINT,
					ignorePath: true,
					changeOrigin: true,
					autoRewrite: true,
				},
				'^/update': {
					target: h_env.VITE_SPARQ_UPDATE_ENDPOINT,
					ignorePath: true,
					changeOrigin: true,
					autoRewrite: true,
				},
				'^/gsp': {
					target: h_env.VITE_SPARQL_GSP_ENDPOINT,
					ignorePath: true,
					changeOrigin: true,
					autoRewrite: true,
				},
			},
		},
	};
});
