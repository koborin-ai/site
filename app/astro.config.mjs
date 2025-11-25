import { defineConfig } from "astro/config";
import node from "@astrojs/node";
import starlight from "@astrojs/starlight";
import { sidebar } from "./src/sidebar.ts";

export default defineConfig({
  site: "https://koborin.ai",
  srcDir: "src",
  output: "server",
  adapter: node({
    mode: "standalone",
  }),
  integrations: [
    starlight({
      title: "koborin.ai",
      description: "Personal site + technical garden",
      favicon: "/favicon.png",
      logo: {
        src: "./src/assets/koborin-ai-header.png",
        replacesTitle: true,
      },
      social: [
        {
          label: "GitHub",
          icon: "github",
          href: "https://github.com/nozomi-koborinai",
        },
        {
          label: "LinkedIn",
          icon: "linkedin",
          href: "https://linkedin.com/in/nozomi-koborinai",
        },
        {
          label: "X",
          icon: "x.com",
          href: "https://x.com/fender_kn",
        },
        {
          label: "Medium",
          icon: "document",
          href: "https://medium.com/@nozomi-koborinai",
        },
      ],
      sidebar,
      customCss: [
        './src/styles/custom.css',
      ],
      components: {
        Head: './src/components/Head.astro',
      },
      head: [
        // Default OG image for pages without custom images
        {
          tag: 'meta',
          attrs: {
            property: 'og:image',
            content: 'https://koborin.ai/og/index.png',
          },
        },
        {
          tag: 'meta',
          attrs: {
            property: 'og:image:width',
            content: '1200',
          },
        },
        {
          tag: 'meta',
          attrs: {
            property: 'og:image:height',
            content: '630',
          },
        },
        {
          tag: 'meta',
          attrs: {
            name: 'twitter:card',
            content: 'summary_large_image',
          },
        },
        {
          tag: 'meta',
          attrs: {
            name: 'twitter:image',
            content: 'https://koborin.ai/og/index.png',
          },
        },
      ],
      // Disable Starlight's default 404 page to allow custom pages
      disable404Route: true,
    }),
  ],
});
