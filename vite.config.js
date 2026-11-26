import { defineConfig } from 'vite';
// Relative paths so the game works on GitHub Pages under any repo name.
// BUILD_TIME shows in Settings, so you can tell which version a device is running.
const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
export default defineConfig({ base: './', server: { host: true }, define: { __BUILD_TIME__: JSON.stringify(stamp) } });
