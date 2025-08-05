import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],

	// Handle WebAssembly and MediaPipe properly
	server: {
		headers: {
			'Cross-Origin-Embedder-Policy': 'credentialless',
			'Cross-Origin-Opener-Policy': 'same-origin'
		}
	},

	// Optimize dependencies including MediaPipe
	optimizeDeps: {
		exclude: []
	},

	// Handle source map issues
	build: {
		sourcemap: false // Disable source maps for production to avoid WASM issues
	},

	// Handle WASM files
	assetsInclude: ['**/*.wasm']
});
