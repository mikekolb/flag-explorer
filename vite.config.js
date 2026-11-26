import { defineConfig } from 'vite';
// Relative paths so the game works on GitHub Pages under any repo name.
export default defineConfig({ base: './', server: { host: true } });
