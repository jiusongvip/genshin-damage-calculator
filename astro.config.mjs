import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://www.genshindamagecalculator.com',
  trailingSlash: 'always',
  integrations: [react(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
});
