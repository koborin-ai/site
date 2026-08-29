/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config';

// getViteConfig gives tests the same module resolution as the app, so modules
// that import Astro virtual modules such as `astro:content` can be loaded.
export default getViteConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
});
