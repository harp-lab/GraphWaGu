import { defineConfig, sortUserPlugins } from 'vite';
import react from '@vitejs/plugin-react-swc';

export default defineConfig(({ mode }) => {
    let plugins = [react()];
    let base = '/GraphWaGu/';

    if (mode == 'html' || mode === undefined) {
        return {
            plugins: plugins,
            base: base,
            build: {
                rollupOptions: {
                    external: [/\.json$/],
                },
            },
        }
    }

    if (mode == 'lib') {
        return {
            plugins: plugins,
            base: base,
            publicDir: false,
            build: {
                lib: {
                    name: 'GraphWaGu',
                    entry: ['src/webgpu/force_directed.ts'],
                    formats: ['es'],
                    fileName: 'graphwagu',
                },
                rollupOptions: {
                    external: ['public'],
                },
                sourcemap: true,
            },
        }
    }

    throw new Error(`unknown vite mode: ${mode}`)
});
