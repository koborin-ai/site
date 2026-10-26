import Slugger from 'github-slugger';
import { visit } from 'unist-util-visit';

type HastNode = {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

function classNames(node: HastNode): string[] {
  const value = node.properties?.className ?? node.properties?.class;
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') return value.split(/\s+/);
  return [];
}

function textOf(node: HastNode): string {
  let text = '';
  visit(node, (child) => {
    if (child.type === 'text' && typeof (child as HastNode).value === 'string') {
      text += (child as HastNode).value;
    }
  });
  return text;
}

const ANCHOR_PATH =
  'm12.11 15.39-3.88 3.88a2.52 2.52 0 0 1-3.5 0 2.47 2.47 0 0 1 0-3.5l3.88-3.88a1 1 0 1 0-1.42-1.42l-3.88 3.89a4.48 4.48 0 0 0 6.33 6.33l3.89-3.88a1 1 0 0 0-1.42-1.42m8.58-12.08a4.49 4.49 0 0 0-6.33 0l-3.89 3.88a1 1 0 1 0 1.42 1.42l3.88-3.88a2.52 2.52 0 0 1 3.5 0 2.47 2.47 0 0 1 0 3.5l-3.88 3.88a1 1 0 0 0 0 1.42 1 1 0 0 0 1.42 0l3.88-3.89a4.49 4.49 0 0 0 0-6.33M8.83 15.17a1 1 0 0 0 .71.29 1 1 0 0 0 .71-.29l4.92-4.92a1 1 0 1 0-1.42-1.42l-4.92 4.92a1 1 0 0 0 0 1.42';

export function rehypeHeadingAnchors() {
  return (tree: HastNode) => {
    // One slugger per file. A shared slugger suffixes ids that already appeared on another page.
    const slugger = new Slugger();
    visit(tree, (node, index, parent) => {
      if (!parent || index === undefined || node.type !== 'element') return;
      const heading = node as HastNode;
      if (!heading.tagName || !/^h[2-6]$/.test(heading.tagName)) return;
      if (classNames(parent as HastNode).includes('sl-heading-wrapper')) return;

      const text = textOf(heading).trim();
      if (!text) return;
      const id = slugger.slug(text);
      heading.properties = { ...heading.properties, id };

      const wrapper: HastNode = {
        type: 'element',
        tagName: 'div',
        properties: { className: ['sl-heading-wrapper', `level-${heading.tagName}`] },
        children: [
          heading,
          {
            type: 'element',
            tagName: 'a',
            properties: { className: ['sl-anchor-link'], href: `#${id}` },
            children: [
              {
                type: 'element',
                tagName: 'span',
                properties: { ariaHidden: 'true', className: ['sl-anchor-icon'] },
                children: [
                  {
                    type: 'element',
                    tagName: 'svg',
                    properties: { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'currentColor' },
                    children: [
                      {
                        type: 'element',
                        tagName: 'path',
                        properties: { d: ANCHOR_PATH },
                        children: [],
                      },
                    ],
                  },
                ],
              },
              {
                type: 'element',
                tagName: 'span',
                properties: { className: ['sr-only'] },
                children: [{ type: 'text', value: `Section titled “${text}”` }],
              },
            ],
          },
        ],
      };
      (parent as HastNode).children![index] = wrapper;
    });
  };
}
