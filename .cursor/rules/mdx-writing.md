# MDX Article Writing Guidelines

Rules for writing and reviewing MDX articles under `app/src/content/docs/`.

## Avoid AI-like Phrasing (Japanese)

When writing or reviewing Japanese articles, flag and rewrite these patterns:

### Writing style by category

| Category | Style | Example endings |
| --- | --- | --- |
| `life/` | だ・である調 | `〜だ。` `〜と思う。` `〜気がする。` |
| `tech/` | です・ます調 | `〜です。` `〜と思います。` `〜かもしれません。` |

When unsure, check existing articles in the same category.

### Patterns to avoid

| Pattern | Problem | Fix |
| --- | --- | --- |
| `つまり、〜` to conclude a section | Feels like AI summarizing | State the fact directly, let the reader draw the conclusion |
| `なぜか。` as a rhetorical question | Abrupt, sounds like AI padding | Move directly into the explanation |
| `〜することをお勧めします` | Condescending/preachy | Use first-person experience: `私の場合、〜` / `〜きっかけになれば嬉しいです` |
| `この〜は、〜でした。` as a generic wrap-up | AI-like conclusion stamp | Either drop it or tie it to a concrete next step |
| New concept introduced without context | Readers have no frame of reference | Always add a bridge sentence from the previous section or a forward reference `[後述](#section)` |

### Sentence ending and tone

AI-generated text tends to over-use assertive endings (`〜だ。` `〜のだ。` `〜である。`), making the writing feel like an essay or self-help book. Mix in softer, more human endings to convey that the author is thinking and feeling, not lecturing.

| Assertive (use sparingly) | Human alternative (mix in) |
| --- | --- |
| `〜だ。` `〜である。` | `〜と思う。` `〜気がする。` `〜かもしれない。` `〜らしい。` `〜みたいだ。` |
| `〜のだ。` (explanatory) | `〜のだろう。` `〜のかなと思う。` |
| `〜ない。` (flat negation) | `〜わけじゃない。` `〜ないのかもしれない。` |
| `〜しかない。` (resignation) | `〜しかないのだろう。` `〜しかないんだろうなと思う。` |

A good ratio is roughly 60-70% assertive, 30-40% softer endings. If all sentences end with `〜だ。`, rewrite some. The same principle applies to です/ます style articles — mix `〜と思います` `〜かもしれません` into `〜です` `〜ます` heavy text.

### Structural patterns to avoid

| Pattern | Example | Why it feels AI | Fix |
| --- | --- | --- | --- |
| 3-item parallel structure | `考えたいことを考え、作りたいものを作り、行きたい場所へ行く。` | Too neat, feels crafted | Remove one item, or rewrite as prose |
| Consecutive 体言止め | `衰えていく体と、それでも前に進みたい自分。好きだったものに打算が混ざる自分と、それに呆れている自分。` | Reads like J-POP lyrics or AI poetry | Rewrite as complete sentences |
| Self-help book conclusions | `そんな生き方の先にこそ、新しく、真実の自分が待っているのかもしれない。` | Overly dramatic, sounds like a book blurb | End with something the author would actually say out loud |
| Grandiose metaphors | `体の芯に疲労が残り` `頭に霧がかかったように` | Over-decorated for a personal blog | Use plain language: `疲れが抜けなくて` `頭がぼんやりする` |
| Parenthesized English annotations | `目的（How）` `手段（What）` | Unnatural if the annotation contradicts the Japanese word | Drop the annotation, or rewrite so the meaning is self-evident |
| Perfect bridge sentences | `けれど、これからどうしていくのかを考えた時、一つだけはっきりしていることがある。` | Classic AI transition, feels like a TED talk | Use casual transitions: `じゃあどうするのかと考えると、〜` |

### Privacy in personal anecdotes (especially Life category)

When writing about personal experiences involving other people:

- Avoid mentioning specific countries, companies, or details that could identify individuals (e.g., use `海外在住の` instead of `スペイン在住の`)
- Focus on the author's experience and feelings, not on describing others

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
