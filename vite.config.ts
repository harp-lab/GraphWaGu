import { defineConfig } from 'vite';
import glsl from 'vite-plugin-glsl';
import react from '@vitejs/plugin-react-swc'

export default defineConfig({
    plugins: [react()],
});
