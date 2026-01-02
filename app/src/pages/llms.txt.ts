import type { APIRoute } from 'astro';
import { textResponse } from '../utils/llms';

const SITE_URL = 'https://koborin.ai';

export const GET: APIRoute = () => {
  const today = new Date().toISOString().slice(0, 10);

  const body = `# koborin.ai
> Personal site + technical garden.
> Last updated: ${today}

## Full (with article content)
- ${SITE_URL}/llms-full.txt
- ${SITE_URL}/llms-ja-full.txt

## By Category

### Tech
- ${SITE_URL}/llms-tech.txt
- ${SITE_URL}/llms-ja-tech.txt

### Life
- ${SITE_URL}/llms-life.txt
- ${SITE_URL}/llms-ja-life.txt

### About Me
- ${SITE_URL}/llms-about-me.txt
- ${SITE_URL}/llms-ja-about-me.txt
`;

  return textResponse(body);
};

