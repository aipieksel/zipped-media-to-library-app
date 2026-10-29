import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { vtracerAssets } from './scripts/vtracer-assets';
export default defineConfig({ plugins: [react(), vtracerAssets()], server: { host: '0.0.0.0', allowedHosts: true }, build: { target: 'es2022' } });
