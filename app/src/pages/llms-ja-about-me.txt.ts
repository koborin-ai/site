import type { APIRoute } from 'astro';
import { getLlmsContent, textResponse } from '../utils/llms';

export const GET: APIRoute = async () => {
  const body = await getLlmsContent('ja', 'about-me');
  return textResponse(body);
};

