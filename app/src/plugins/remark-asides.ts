import { directiveToMarkdown } from 'mdast-util-directive';
import { toMarkdown } from 'mdast-util-to-markdown';
import { toString } from 'mdast-util-to-string';
import type { Root } from 'mdast';
import { visit } from 'unist-util-visit';

const VARIANTS = ['note', 'tip', 'caution', 'danger'] as const;
type Variant = (typeof VARIANTS)[number];

const TITLES: Record<'en' | 'ja', Record<Variant, string>> = {
  en: { note: 'Note', tip: 'Tip', caution: 'Caution', danger: 'Danger' },
  ja: { note: 'ノート', tip: 'ヒント', caution: '注意', danger: '危険' },
};

const ICON_PATHS: Record<Variant, string> = {
  note: 'M12 2a10 10 0 1 0 .01 20.01A10 10 0 0 0 12 2zm1 15h-2v-6h2zm0-8h-2V7h2z',
  tip: 'M9 21h6v-1H9zm3-19a7 7 0 0 0-4 12.74V17h8v-2.26A7 7 0 0 0 12 2z',
  caution: 'M12 2 1 21h22zm1 15h-2v-2h2zm0-4h-2V9h2z',
  danger: 'M12 2a10 10 0 1 0 .01 20.01A10 10 0 0 0 12 2zm1 15h-2v-2h2zm0-4h-2V7h2z',
};

type MdastNode = {
  type: string;
  name?: string;
  value?: string;
  children?: MdastNode[];
  data?: {
    directiveLabel?: boolean;
    hName?: string;
    hProperties?: Record<string, unknown>;
  };
};

function isVariant(name: string | undefined): name is Variant {
  return (VARIANTS as readonly string[]).includes(name ?? '');
}

function element(tagName: string, properties: Record<string, unknown>, children: MdastNode[]): MdastNode {
  return {
    type: 'paragraph',
    data: { hName: tagName, hProperties: properties },
    children,
  };
}

function localeFromPath(filePath: string | undefined): 'en' | 'ja' {
  if (!filePath) return 'en';
  return filePath.includes('/ja/') || filePath.endsWith('/ja') ? 'ja' : 'en';
}

/**
 * `remark-directive` also flags mid-sentence `:name` tokens. Put those back
 * as text so prose that is not an aside survives.
 */
function restoreUnhandledDirective(): (tree: Root) => void {
  return (tree) => {
    visit(tree, (node, index, parent) => {
      if (!parent || index === undefined) return;
      if (node.type !== 'textDirective' && node.type !== 'leafDirective') return;
      if (node.data) return;
      let markdown = toMarkdown(node, { extensions: [directiveToMarkdown()] });
      if (markdown.endsWith('\n')) markdown = markdown.slice(0, -1);
      const text = { type: 'text' as const, value: markdown };
      parent.children[index] =
        node.type === 'textDirective' ? text : { type: 'paragraph', children: [text] };
    });
  };
}

export function remarkAsides() {
  return (tree: Root, file: { path?: string }) => {
    const locale = localeFromPath(file.path);
    visit(tree, (node, index, parent) => {
      if (!parent || index === undefined || node.type !== 'containerDirective') return;
      if (!isVariant(node.name)) return;

      const directive = node as MdastNode;
      const children = directive.children ?? [];
      let title = TITLES[locale][node.name];
      let titleNodes: MdastNode[] = [{ type: 'text', value: title }];
      const first = children[0];
      if (
        first?.type === 'paragraph' &&
        first.data?.directiveLabel &&
        (first.children?.length ?? 0) > 0
      ) {
        titleNodes = first.children ?? titleNodes;
        title = toString(first as unknown as Root);
        children.splice(0, 1);
      }

      parent.children[index] = element(
        'aside',
        {
          class: `starlight-aside starlight-aside--${node.name}`,
          ariaLabel: title,
        },
        [
          element('p', { class: 'starlight-aside__title', ariaHidden: 'true' }, [
            element(
              'svg',
              {
                viewBox: '0 0 24 24',
                width: 16,
                height: 16,
                fill: 'currentColor',
                class: 'starlight-aside__icon',
                ariaHidden: 'true',
              },
              [element('path', { d: ICON_PATHS[node.name] }, [])]
            ),
            ...titleNodes,
          ]),
          element('div', { class: 'starlight-aside__content' }, children),
        ]
      ) as unknown as typeof node;
    });
  };
}

export function remarkRestoreDirectives() {
  return restoreUnhandledDirective();
}
