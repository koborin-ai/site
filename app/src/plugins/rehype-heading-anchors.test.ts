import { describe, expect, it } from 'vitest';
import { rehypeHeadingAnchors } from './rehype-heading-anchors';

type Node = {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: Node[];
  value?: string;
};

function heading(text: string): Node {
  return {
    type: 'element',
    tagName: 'h2',
    properties: {},
    children: [{ type: 'text', value: text }],
  };
}

function headingId(tree: Node, index: number): unknown {
  const wrapper = tree.children?.[index];
  return wrapper?.children?.[0]?.properties?.id;
}

describe('rehypeHeadingAnchors', () => {
  it('reuses a heading id on the next page instead of suffixing it', () => {
    const transform = rehypeHeadingAnchors() as (tree: Node) => void;
    const first = { type: 'root', children: [heading('まとめ')] };
    const second = { type: 'root', children: [heading('まとめ')] };

    transform(first);
    transform(second);

    expect(headingId(first, 0)).toBe('まとめ');
    expect(headingId(second, 0)).toBe('まとめ');
  });

  it('suffixes a repeated heading on the same page', () => {
    const transform = rehypeHeadingAnchors() as (tree: Node) => void;
    const tree = { type: 'root', children: [heading('Overview'), heading('Overview')] };

    transform(tree);

    expect(headingId(tree, 0)).toBe('overview');
    expect(headingId(tree, 1)).toBe('overview-1');
  });
});
