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
    }),
  ],
});
