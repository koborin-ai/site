# MDX Article Writing Guidelines

Rules for writing and reviewing MDX articles under `app/src/content/docs/`.

## Avoid AI-like Phrasing (Japanese)

When writing or reviewing Japanese articles, flag and rewrite these patterns:

### Patterns to avoid

| Pattern | Problem | Fix |
| --- | --- | --- |
| `つまり、〜` to conclude a section | Feels like AI summarizing | State the fact directly, let the reader draw the conclusion |
| `なぜか。` as a rhetorical question | Abrupt, sounds like AI padding | Move directly into the explanation |
| `〜することをお勧めします` | Condescending/preachy | Use first-person experience: `私の場合、〜` / `〜きっかけになれば嬉しいです` |
| `この〜は、〜でした。` as a generic wrap-up | AI-like conclusion stamp | Either drop it or tie it to a concrete next step |
| New concept introduced without context | Readers have no frame of reference | Always add a bridge sentence from the previous section or a forward reference `[後述](#section)` |

### Context bridging ("いつもの指摘" pattern)

Every new section or concept must connect to what came before. Before introducing a new term or topic:

1. Reference where it appeared earlier (e.g., "In the previous section, we saw `tools` in Server Capabilities...")
2. Explain why the reader should care now
3. Provide an official documentation link if it is the first mention of a spec concept
4. If a concept is explained in a later section, add a forward reference: `（schemantic、[後述](#schemantic-との統合)）`

## Section Heading Guidelines

### Style consistency

- Use **noun-phrase / topic style** headings, not question-style
  - Good: `自前実装を選んだ理由`
  - Bad: `なぜコミュニティ SDK を使わず自前実装したのか`
- For bilingual concepts, use the **colon pattern**: `Japanese topic：English term`
  - Example: `MCP の機能交渉：Capabilities Negotiation`
- Keep heading length concise — long headings wrap awkwardly in the sidebar and TOC

### Tone in headings

- Avoid headings that put down alternatives or other projects
  - Bad: `なぜ〜を使わなかったのか` (sounds like criticizing the alternative)
  - Good: `自前実装を選んだ理由` (focuses on the author's decision)

## Closing Section Tone

- Do NOT end with prescriptive advice like `〜を読むことをお勧めします`
- Instead, share personal experience: `私の場合、〜で解像度が上がりました`
- Close with an open offering: `この記事が〜のきっかけになれば嬉しいです`

## Content Deduplication

- Before adding an explanation, check if the same topic is already covered elsewhere in the article
- If content fits better in another section, move it there and leave a cross-reference
  - Example: Personal experience about `isError` → move to "Gotchas" section, add `[後述のセクション](#section)` in the original location
