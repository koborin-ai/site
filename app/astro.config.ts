import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import { unified } from "@astrojs/markdown-remark";
import remarkDirective from "remark-directive";
import remarkGfm from "remark-gfm";
import { rehypeDiagrams } from "./src/plugins/rehype-diagrams.ts";
import { rehypeHeadingAnchors } from "./src/plugins/rehype-heading-anchors.ts";
import { remarkAsides, remarkRestoreDirectives } from "./src/plugins/remark-asides.ts";

export default defineConfig({
  site: "https://koborin.ai",
  srcDir: "src",
  build: {
    inlineStylesheets: "always",
  },
  markdown: {
    syntaxHighlight: {
      type: "shiki",
      excludeLangs: ["math", "mermaid"],
    },
    shikiConfig: {
      themes: {
        light: "vitesse-light",
        dark: "vitesse-dark",
      },
      defaultColor: false,
    },
    processor: unified({
      remarkPlugins: [remarkGfm, remarkDirective, remarkAsides, remarkRestoreDirectives],
      rehypePlugins: [rehypeDiagrams, rehypeHeadingAnchors],
    }),
  },
  integrations: [
    mdx(),
    sitemap({
      filter: (page) => !page.includes("/404"),
    }),
  ],
});
