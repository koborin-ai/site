import { createMdxProcessor } from '../../node_modules/@astrojs/markdown-remark/dist/mdx/create-processor.js';
import type { PluggableList } from 'unified';
import { VFile } from 'vfile';
import { describe, expect, it } from 'vitest';
import { rehypePreserveMermaidStyle } from './rehype-preserve-mermaid-style';

const MERMAID_CSS =
  '#mermaid-0 .node rect{fill:#ececff;stroke:#9370db}#mermaid-0 .cluster rect{fill:#ffffde}#mermaid-0 .edgePath .path{stroke:#666}';

function injectDiagrams() {
  return (tree: { children: unknown[] }) => {
    tree.children.push(
      {
        type: 'element',
        tagName: 'style',
        properties: {},
        children: [{ type: 'text', value: '.author{color:red}' }],
      },
      {
        type: 'element',
        tagName: 'svg',
        properties: { id: 'mermaid-0' },
        children: [
          {
            type: 'element',
            tagName: 'style',
            properties: {},
            children: [{ type: 'text', value: MERMAID_CSS }],
          },
          {
            type: 'element',
            tagName: 'g',
            properties: { className: ['node'] },
            children: [
              {
                type: 'element',
                tagName: 'rect',
                properties: {},
                children: [],
              },
            ],
          },
        ],
      }
    );
  };
}

async function compile(rehypePlugins: PluggableList): Promise<string> {
  const processor = createMdxProcessor(
    {
      syntaxHighlight: false,
      shikiConfig: {},
      gfm: false,
      smartypants: false,
      remarkPlugins: [],
      rehypePlugins,
      remarkRehype: {},
      recmaPlugins: [],
      optimize: true,
    },
    { sourcemap: false }
  );
  const file = new VFile({ value: 'Hello\n', path: 'diagram.mdx' });
  file.data.astro = { frontmatter: {} };
  const compiled = await processor.process(file);
  const code = String(compiled.value);
  const match = code.match(/"set:html": ("(?:[^"\\]|\\.)*")/);
  if (!match?.[1]) {
    throw new Error(`compiled MDX has no static HTML:\n${code}`);
  }
  return JSON.parse(match[1]) as string;
}

describe('rehypePreserveMermaidStyle', () => {
  it('leaves Mermaid SVG style CSS as element text through Astro static MDX optimization', async () => {
    const html = await compile([injectDiagrams, rehypePreserveMermaidStyle]);

    expect(html).toContain(`<style>${MERMAID_CSS}<!----></style>`);
    expect(html).not.toMatch(/<svg[^>]*>[\s\S]*<style[^>]*set:html/);
    expect(html).toContain('<style set:html=".author{color:red}"></style>');
  });

  it('reproduces the empty style attribute without the guard', async () => {
    const html = await compile([injectDiagrams]);

    expect(html).toContain(`<style set:html="${MERMAID_CSS}"></style>`);
    expect(html).not.toContain(`<style>${MERMAID_CSS}`);
  });
});
