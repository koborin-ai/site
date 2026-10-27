import rehypeMermaid, { type RehypeMermaidOptions } from 'rehype-mermaid';
import { unified } from 'unified';
import { SKIP, visit } from 'unist-util-visit';
import type { VFile } from 'vfile';

type HastNode = {
  type: string;
  tagName?: string;
  name?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

// Inside each SVG, mermaid prefixes every rule with #mermaid-N and appends this after its theme,
// so equal specificity wins. Text needs !important: mermaid sets it through id-plus-class rules.
const SHARED = `
  text, tspan { fill: var(--diagram-text) !important; }
  span, p, div { color: var(--diagram-text) !important; }
  .marker { fill: var(--diagram-line); stroke: var(--diagram-line); }
`;

// Keyed by the aria-roledescription mermaid writes on the root <svg>.
const PAINT: Record<string, string> = {
  'flowchart-v2': `
    .node rect, .node circle, .node ellipse, .node polygon, .node path { fill: var(--diagram-surface); stroke: var(--diagram-border); }
    .cluster rect { fill: transparent; stroke: var(--diagram-border); }
    .flowchart-link { stroke: var(--diagram-line); }
    .edgeLabel, .edgeLabel p, .labelBkg { background-color: var(--diagram-surface); }
    .edgeLabel rect { fill: var(--diagram-surface); opacity: 1; }
  `,
  sequence: `
    .actor, .labelBox { fill: var(--diagram-surface); stroke: var(--diagram-border); }
    .actor-line, .messageLine0, .messageLine1 { stroke: var(--diagram-line); }
    .loopLine { stroke: var(--diagram-line); fill: var(--diagram-line); }
    [id$="-arrowhead"] path, [id$="-crosshead"] path, [id$="-filled-head"] path { fill: var(--diagram-line); stroke: var(--diagram-line); }
    .note, .activation0, rect.rect { fill: var(--diagram-tint); stroke: var(--diagram-border); filter: none; }
    [id$="-sequencenumber"] { fill: var(--diagram-line); }
    text.sequenceNumber { fill: var(--diagram-surface) !important; }
  `,
};

const OPTIONS: RehypeMermaidOptions = {
  strategy: 'inline-svg',
  css: new URL('../styles/diagram-fonts.css', import.meta.url),
  mermaidConfig: {
    theme: 'neutral',
    fontFamily: '"Geist", "Noto Sans JP", "Noto Sans JP Fallback", sans-serif',
    themeCSS: SHARED + Object.values(PAINT).join(''),
  },
};

function hasClass(node: HastNode | undefined, name: string): boolean {
  const className = node?.properties?.className;
  return Array.isArray(className) && className.includes(name);
}

// MDX keeps a raw <table> in an article as a JSX node, so it reaches this pass without a tagName.
function isTable(node: HastNode): boolean {
  return node.tagName === 'table' || (node.type === 'mdxJsxFlowElement' && node.name === 'table');
}

function isDiagram(node: HastNode): boolean {
  return node.tagName === 'svg' && String(node.properties?.id ?? '').startsWith('mermaid-');
}

function toNaturalSize(svg: HastNode): void {
  const [, , width, height] = String(svg.properties?.viewBox ?? '').split(/[\s,]+/).map(Number);
  const style = String(svg.properties?.style ?? '').replace(/max-width:\s*[^;]+;?/, '').trim();
  svg.properties = { ...svg.properties, width, height, style: style || undefined };
}

function wrap(node: HastNode, tagName: string, className: string): HastNode {
  return { type: 'element', tagName, properties: { className: [className] }, children: [node] };
}

export function rehypeDiagrams() {
  const render = rehypeMermaid.call(unified(), OPTIONS) as (
    tree: HastNode,
    file: VFile,
  ) => Promise<void>;
  return async (tree: HastNode, file: VFile) => {
    await render(tree, file);
    visit(tree, (node: HastNode, index, parent: HastNode | undefined) => {
      if (!parent?.children || index === undefined) return;
      if (isTable(node)) {
        if (!hasClass(parent, 'table-frame')) parent.children[index] = wrap(node, 'div', 'table-frame');
        return;
      }
      if (!isDiagram(node) || hasClass(parent, 'diagram')) return;
      const role = String(node.properties?.ariaRoleDescription ?? '');
      if (!(role in PAINT)) {
        file.fail(`Mermaid "${role}" diagrams have no token mapping in rehype-diagrams PAINT`);
      }
      toNaturalSize(node);
      parent.children[index] = wrap(node, 'figure', 'diagram');
      return SKIP;
    });
  };
}
