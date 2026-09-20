import type { Root, Heading, Paragraph, List, ListItem, Table } from 'mdast';

export interface RequirementNode {
  readonly id: string;
  readonly prefix: string;
  readonly title: string;
  readonly content: string;
  readonly tags: readonly string[];
  readonly startLine?: number;
  readonly endLine?: number;
}

export interface SpecSectionNode {
  readonly title: string;
  readonly level: number;
  readonly content: string;
  readonly requirementIds: readonly string[];
  readonly tags: readonly string[];
  readonly requirements: readonly RequirementNode[];
  readonly startLine?: number;
  readonly endLine?: number;
}

export interface MarkdownAst {
  readonly tree: Root;
  readonly sections: readonly SpecSectionNode[];
  readonly requirements: readonly RequirementNode[];
}

export type MdastBlock = Heading | Paragraph | List | ListItem | Table;
