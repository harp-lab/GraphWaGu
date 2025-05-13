import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import glsl from 'vite-plugin-glsl';
import dts from 'vite-plugin-dts';

export default defineConfig(({ mode }) => {
  const commonPlugins = [react(), glsl()];
  const base = '/GraphWaGu/';

  if (!mode || mode === 'html') {
    return {
      plugins: commonPlugins,
      base,
      build: {
        rollupOptions: { external: [/\.json$/] },
      },
    };
  }

  if (mode === 'lib') {
    return {
      plugins: [
        ...commonPlugins,
        // ← this will generate a single graphwagu.d.ts in dist/
        dts({ outDir: 'dist', insertTypesEntry: true }),
      ],
      publicDir: false,
      build: {
        lib: {
          name: 'GraphWaGu',
          entry: 'src/webgpu/force_directed.ts',
          formats: ['es'],
          fileName: 'graphwagu',
        },
        rollupOptions: {
          external: ['@webgpu/types'],
          output: {
            globals: { '@webgpu/types': 'WebGPU' },
          },
        },
        sourcemap: true,
      },
    };
  }

  throw new Error(`unknown vite mode: ${mode}`);
});
