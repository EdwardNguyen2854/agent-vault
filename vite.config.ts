import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? 'agent-vault';
const githubPagesBase = `/${repoName}/`;

export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE ?? githubPagesBase,
  server: {
    port: 5174,
    host: true,
    proxy: {
      '/lms': {
        target: 'http://localhost:1234',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/lms/, ''),
      },
      '/mcp-bridge': {
        target: 'http://localhost:7777',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/mcp-bridge/, ''),
      },
    },
  },
});
