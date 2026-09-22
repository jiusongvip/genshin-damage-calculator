import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://www.genshindamagecalculator.com',
  trailingSlash: 'always',
  // Real 301s live in vercel.json (the hosting platform). This mirror covers
  // anything Vercel's routing does not serve — dev and astro preview — so the
  // old URL never 404s locally; in a static build Astro renders it as a
  // meta-refresh page, which the Vercel 301 outranks in production.
  redirects: {
    '/how-damage-is-calculated/': '/guides/damage-formula/',
  },
  integrations: [react(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
});
