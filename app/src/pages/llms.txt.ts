import type { APIRoute } from 'astro';
import { textResponse } from '../utils/llms';

const SITE_URL = 'https://koborin.ai';

export const GET: APIRoute = () => {
  const body = `# koborin.ai

> Personal site and technical garden.

Long-form files include the Markdown of every published page. This index only lists those files.

## Full content

- [English, with article bodies](${SITE_URL}/llms-full.txt): Every published English page.
- [Japanese, with article bodies](${SITE_URL}/llms-ja-full.txt): Every published Japanese page.

## Tech

- [English tech](${SITE_URL}/llms-tech.txt): Published English tech articles.
- [Japanese tech](${SITE_URL}/llms-ja-tech.txt): Published Japanese tech articles.

## Life

- [English life](${SITE_URL}/llms-life.txt): Published English life articles.
- [Japanese life](${SITE_URL}/llms-ja-life.txt): Published Japanese life articles.
`;

  return textResponse(body);
};

