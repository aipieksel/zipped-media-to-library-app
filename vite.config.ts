import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { vtracerAssets } from './scripts/vtracer-assets';
import {qaWorkspacePlugin} from './scripts/qa-workspace-plugin';
export default defineConfig({ plugins: [react(), vtracerAssets(), qaWorkspacePlugin()], server: { host: '0.0.0.0', allowedHosts: true }, build: { target: 'es2022' } });
