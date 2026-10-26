import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import { unified } from "@astrojs/markdown-remark";
import rehypeMermaid from "rehype-mermaid";
import remarkDirective from "remark-directive";
import remarkGfm from "remark-gfm";
import { rehypeHeadingAnchors } from "./src/plugins/rehype-heading-anchors.ts";
import { remarkAsides, remarkRestoreDirectives } from "./src/plugins/remark-asides.ts";

export default defineConfig({
  site: "https://koborin.ai",
  srcDir: "src",
  markdown: {
    syntaxHighlight: {
      type: "shiki",
      excludeLangs: ["math", "mermaid"],
    },
    shikiConfig: {
      themes: {
        light: "github-light",
        dark: "github-dark",
      },
      defaultColor: false,
    },
    processor: unified({
      remarkPlugins: [remarkGfm, remarkDirective, remarkAsides, remarkRestoreDirectives],
      rehypePlugins: [
        [
          rehypeMermaid,
          {
            strategy: "inline-svg",
            mermaidConfig: { theme: "neutral" },
          },
        ],
        rehypeHeadingAnchors,
      ],
    }),
  },
  integrations: [
    mdx(),
    sitemap({
      filter: (page) => !page.includes("/404"),
    }),
  ],
});
