import { defineConfig } from "astro/config";
import node from "@astrojs/node";

// https://docs.astro.build/en/install-and-setup/
export default defineConfig({
  srcDir: "src",
  output: "server",
  adapter: node({
    mode: "standalone",
  }),
});
