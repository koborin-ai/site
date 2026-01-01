import type { APIRoute } from 'astro';
import { getLlmsContent, textResponse } from '../utils/llms';

export const GET: APIRoute = async () => {
  const body = await getLlmsContent('en', 'tech');
  return textResponse(body);
};

