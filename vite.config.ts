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
  // Security headers for production builds
  // note: dev server does not apply these; use a reverse proxy or deploy config for CSP in development.
  build: {
    rollupOptions: {
      output: {
        // Ensure sourcemaps are not exposed in production
        sourcemap: false,
      },
    },
  },
});

// Apply security headers via preview server config when using Vite's preview
// For actual deployment, configure these headers in your hosting platform (Vercel, Netlify, etc.)
/**
 * Recommended security headers for Agent Vault:
 *
 * Content-Security-Policy:
 *   default-src 'self';
 *   script-src 'self' 'unsafe-inline';        // Required for React/Vite HMR in dev; tighten for production
 *   style-src 'self' 'unsafe-inline';         // Required for inline styles
 *   img-src 'self' data: blob:;              // Allow images from vault files and inline data URIs
 *   connect-src 'self' http://localhost:1234 http://localhost:7777;
 *   frame-src 'none';                         // Prevent clickjacking - no iframes needed
 *   object-src 'none';                       // Prevent plugin-based attacks
 *   base-uri 'self';                         // Prevent base tag injection
 *   form-action 'self';                      // Restrict form submissions
 *
 * X-Frame-Options: DENY                      // Prevent site from being embedded in iframes
 * X-Content-Type-Options: nosniff            // Prevent MIME-type sniffing
 * X-XSS-Protection: 0                       // Disable XSS auditor (CSP provides better protection)
 * Referrer-Policy: strict-origin-when-cross-origin
 * Permissions-Policy: camera=(), microphone=(), geolocation=()
 */
