// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// Static output. Zero JS by default; React islands hydrate only where needed.
export default defineConfig({
  output: 'static',
  // The floating dev-toolbar island is dev-only noise; turn it off.
  devToolbar: { enabled: false },
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
});
