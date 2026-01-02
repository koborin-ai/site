import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import rehypeMermaid from "rehype-mermaid";
import { sidebar } from "./src/sidebar.ts";

export default defineConfig({
  site: "https://koborin.ai",
  srcDir: "src",
  // Static output mode (default) - all pages are pre-rendered at build time
  markdown: {
    rehypePlugins: [
      [
        rehypeMermaid,
        {
          strategy: "inline-svg",
          mermaidConfig: { theme: "neutral" },
        },
      ],
    ],
  },
  integrations: [
    starlight({
      title: "koborin.ai",
      defaultLocale: "root",
      locales: {
        root: { label: "English", lang: "en" },
        ja: { label: "日本語" },
      },
      description: "Personal site + technical garden",
      lastUpdated: true,
      favicon: "/favicon.png",
      logo: {
        src: "./src/assets/_shared/koborin-ai-header.webp",
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
        PageTitle: './src/components/PageTitle.astro',
        ThemeSelect: './src/components/ThemeSelect.astro',
        Header: './src/components/SiteHeader.astro',
        Sidebar: './src/components/Sidebar.astro',
        Pagination: './src/components/Pagination.astro',
      },
      head: [
        // OG image is handled dynamically in Head.astro component
        {
          tag: 'meta',
          attrs: {
            name: 'twitter:card',
            content: 'summary_large_image',
          },
        },
      ],
      // Disable Starlight's default 404 page to allow custom pages
      disable404Route: true,
    }),
  ],
});
