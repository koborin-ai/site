import { ImageResponse } from '@vercel/og';
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import React from 'react';

// Minimal type for OG image generation props
interface OGPageData {
  title?: string;
  description?: string;
}

export async function getStaticPaths() {
  const docs = await getCollection('docs');
  
  // Generate paths for all docs pages
  const paths: Array<{ params: { slug: string }; props: { pageData: OGPageData } }> = docs.map((doc) => {
    const slug = doc.id.replace(/\.(mdx?|md)$/, '');
    return {
      params: { slug },
      props: { pageData: { title: doc.data.title, description: doc.data.description } },
    };
  });
  
  // Add index page (Landing page) - not part of docs collection
  paths.push({
    params: { slug: 'index' },
    props: {
      pageData: {
        title: 'Welcome to koborin.ai',
        description: 'Personal site and technical garden by Nozomi Koborinai',
      },
    },
  });
  
  return paths;
}

export const GET: APIRoute = async ({ props }) => {
  const { pageData } = props as { pageData: OGPageData };
  const title = pageData.title || 'koborin.ai';
  const description = pageData.description || 'Personal site + technical garden';

  // Generate OG image with title and description using React.createElement
  return new ImageResponse(
    React.createElement(
      'div',
      {
        style: {
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0f172a',
          backgroundImage: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          padding: '80px',
        },
      },
      React.createElement(
        'div',
        {
          style: {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
          },
        },
        // Site name
        React.createElement(
          'div',
          {
            style: {
              fontSize: 48,
              fontWeight: 700,
              color: '#60a5fa',
              marginBottom: 40,
              letterSpacing: '-0.02em',
            },
          },
          'koborin.ai'
        ),
        // Page title
        React.createElement(
          'div',
          {
            style: {
              fontSize: 72,
              fontWeight: 800,
              color: '#ffffff',
              textAlign: 'center',
              marginBottom: 30,
              lineHeight: 1.2,
              maxWidth: '90%',
              letterSpacing: '-0.03em',
            },
          },
          title
        ),
        // Description
        React.createElement(
          'div',
          {
            style: {
              fontSize: 32,
              color: '#94a3b8',
              textAlign: 'center',
              maxWidth: '80%',
              lineHeight: 1.4,
            },
          },
          description
        )
      )
    ),
    {
      width: 1200,
      height: 630,
    }
  );
};

