# MDX Article Writing Guidelines

Rules for writing and reviewing MDX articles under `app/src/content/docs/`.

## Follow the Existing Articles

The published articles are the specification for how these articles read. Before writing or editing Japanese prose, open two or three existing articles in the same category and match them. Do not work from a remembered idea of the house style.

Read them for sentence endings and rhythm, how sections open and close, how much the author hedges versus asserts, and how links and images sit in the prose. Style rules written down here would only be a lossy copy of what those files already show.

Two things worth knowing before you read:

- `life/` is written in だ・である調 and `tech/` in です・ます調. This holds across every article with no exceptions, so pick the category first.
- When editing a draft the author wrote, keep their wording. Fix typos, broken references, contradictions, and repetition. Do not smooth their phrasing into something more polished, and do not add declarations of intent they did not make.

## Do Not Obscure People or Companies

Name people, countries, and companies as they actually are (for example スペインの GDE, not 海外の GDE). Existing articles do this, and vagueness reads as evasion rather than discretion.

## Section Headings

- Use noun-phrase / topic style headings, not question style
  - Good: `自前実装を選んだ理由`
  - Bad: `なぜコミュニティ SDK を使わず自前実装したのか`
- For bilingual concepts, use the colon pattern: `Japanese topic：English term`
  - Example: `MCP の機能交渉：Capabilities Negotiation`
- Keep headings short. Long ones wrap awkwardly in the sidebar and the table of contents.
- Do not put down alternatives or other projects in a heading
  - Bad: `なぜ〜を使わなかったのか`
  - Good: `自前実装を選んだ理由`

## Avoid Repeating Yourself

Before adding an explanation, check whether the article already covers it. If the content belongs in another section, move it there and leave a cross-reference such as `[後述のセクション](#section)`.
