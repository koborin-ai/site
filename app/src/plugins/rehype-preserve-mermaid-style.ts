/**
 * Keep inline-SVG `<style>` rules as element text.
 *
 * Starlight compiles MDX with `mdx({ optimize: true })`. Two rehype passes then
 * run after user plugins:
 *
 * 1. `rehypeCollapseScriptStyle` moves literal `<style>` children onto a
 *    `set:html` property and clears the children.
 * 2. `rehypeOptimizeStatic` serializes that static subtree with
 *    `hast-util-to-html`, which prints the property as a literal HTML attribute.
 *
 * The built page therefore contains `<style set:html="…css…"></style>`.
 * Browsers ignore the unknown attribute, so Mermaid's theme rules never apply
 * and shapes fall back to SVG's default black fill.
 *
 * A comment child is not a literal string, so step 1 leaves the CSS text in
 * place and step 2 emits `<style>…css…<!----></style>`. HTML parses the empty
 * comment as a comment node; the CSS text stays the stylesheet.
 */

type HastNode = {
  type: string;
  tagName?: string;
  value?: string;
  children?: HastNode[];
};

function isElement(
  node: HastNode
): node is HastNode & { tagName: string; children: HastNode[] } {
  return (
    node.type === 'element' &&
    typeof node.tagName === 'string' &&
    Array.isArray(node.children)
  );
}

function protectStyleElement(style: HastNode & { children: HastNode[] }): void {
  if (style.children.length === 0) return;
  if (style.children.some((child) => child.type !== 'text')) return;
  style.children.push({ type: 'comment', value: '' });
}

function visit(node: HastNode, insideSvg: boolean): void {
  const inSvg = insideSvg || (isElement(node) && node.tagName === 'svg');
  if (inSvg && isElement(node) && node.tagName === 'style') {
    protectStyleElement(node);
  }
  for (const child of node.children ?? []) {
    visit(child, inSvg);
  }
}

/** Rehype plugin. Run it immediately after `rehype-mermaid`. */
export function rehypePreserveMermaidStyle() {
  return (tree: HastNode) => {
    visit(tree, false);
  };
}
