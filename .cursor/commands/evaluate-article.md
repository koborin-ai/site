# /evaluate-article

## Overview
`/evaluate-article` performs a comprehensive evaluation of blog articles across 7 dimensions, providing constructive feedback with specific improvement suggestions. The command reads the specified article file, applies strict evaluation criteria, and generates a detailed Markdown report with scores, analysis, and actionable recommendations.

## Usage
```text
/evaluate-article <filepath>
```

- `<filepath>` (required): Path to the article file to evaluate (e.g., `app/src/content/docs/tech/my-article.mdx`)

## Prerequisites
- Article file must exist and be readable
- Works with `.md`, `.mdx`, or other text-based article formats

## Evaluation Dimensions

### Scoring Scale (0.0-5.0)
| Score | Level | Description |
|-------|-------|-------------|
| 5.0 | Exceptional | Flawless to a professional editor's eye (rare, <5%) |
| 4.0-4.9 | Commercial | Publication-ready for commercial media (~15%) |
| 3.0-3.9 | Standard | Typical technical blog level (~50%) |
| 2.0-2.9 | Needs Work | Clear improvement needed (~25%) |
| 0.0-1.9 | Major Issues | Major revision required before publication (~5%) |

**Important:** When in doubt, assign the lower score. Generous scoring doesn't help the author improve.

### 7 Evaluation Criteria

#### 1. Defensibility (0.0-5.0)
Can claims withstand technical criticism?
- Clear distinction between subjective/objective statements
- Explicit assumptions and constraints
- Evidence and sources appropriately cited
- Consideration of alternative approaches
- Expression of honesty and humility

#### 2. Logical Organization (0.0-5.0)
Is complex information clearly structured?
- Information priority and emphasis
- Logical flow from problem to solution
- Visible thought process
- Balance between abstract and concrete
- Clear path to conclusion

#### 3. Practical Applicability (0.0-5.0)
Can readers actually implement this?
- Specific procedures and methods
- Author's unique experiences and insights
- Working code examples
- Troubleshooting information
- Reproducibility

#### 4. Structure & Readability (0.0-5.0)
Does structure aid comprehension?
- Compelling introduction
- Appropriate heading hierarchy
- Effective visual elements (diagrams, code blocks)
- Good text rhythm and pacing
- Appropriate information density

#### 5. Communication (0.0-5.0)
Is there human connection with readers?
- Author's personality and voice
- Empathy for reader struggles
- Technical terms explained
- Humor and approachability
- Engagement encouragement

#### 6. Controversy Risk (0.0-5.0) *Higher = Safer*
Could this cause unintended backlash?
- No discriminatory metaphors/analogies
- No stereotyping of groups
- Expressions won't be misread
- Safe even if excerpted on social media
- Corporate brand impact considered

**Note:** Evaluate based on how readers might perceive it, not author's intent.

#### 7. Human Authenticity (0.0-5.0) *Higher = Better*
Does it read like a human wrote it?
- Natural style variation
- Authentic emotional expression
- Personal quirks and voice
- Unexpected perspectives
- Not template-like or formulaic

## Execution Flow (steps)

### 1. Read and understand the article
- Load the specified file
- Identify target audience
- Determine article purpose (tutorial, analysis, experience sharing, etc.)
- Note if corporate/organizational names are associated

### 2. Evaluate each dimension
For each of the 7 criteria:
- Identify specific strengths with examples
- Identify specific weaknesses with examples
- Assign a score based on the rubric
- Prepare actionable improvement suggestions

### 3. Perform controversy risk analysis
Apply the controversy risk checklist:
- [ ] Does not compare people to animals/objects/machines
- [ ] Does not stereotype specific attributes
- [ ] "People who are X" expressions cannot be read as discriminatory
- [ ] Metaphors cannot be misread as implying people
- [ ] No expressions justifying isolation/exclusion
- [ ] Disclaimers are not just excuses
- [ ] Safe even with malicious SNS excerpting
- [ ] Anticipated "most critical reader" reaction

### 4. Check for mechanical writing signs
- Frequent "as follows" or "regarding"
- Overly neat/predictable structure
- Lack of specific failure stories
- Unnatural emotional expression
- Only generalities, no specifics

### 5. Generate the evaluation report
Output a Markdown report with:
- Summary scores table with visual progress bars
- Detailed evaluation for each dimension
- Controversy risk analysis section
- Priority improvement suggestions (TOP 3)
- Rewrite examples for problematic sections
- Article strengths summary

## Output Format

```markdown
# [Article Title] Evaluation Report

## Evaluation Summary

- **Overall Score**: X.X/5.0 (average of dimensions 1-5)
- **Controversy Risk**: X.X/5.0 (higher = safer)
- **Human Authenticity**: X.X/5.0

### Score by Category
---
Defensibility           ████████░░ 4.0/5.0
Logical Organization    ██████░░░░ 3.0/5.0
Practical Applicability ████████░░ 4.0/5.0
Structure & Readability ███████░░░ 3.5/5.0
Communication           █████░░░░░ 2.5/5.0
---
Controversy Risk        ████████░░ 4.0/5.0
Human Authenticity      ████████░░ 4.0/5.0
---

## Detailed Evaluation by Category

### 1. Defensibility: X.X/5.0

**Strengths:**
- [Specific example from the article]

**Areas for Improvement:**
- [Specific problem]
- **Suggestion**: [Actionable fix]

[... repeat for all 7 dimensions ...]

## Priority Improvement Suggestions TOP 3

### 1. [Most Critical]
**Current State**: [Problem]
**Suggestion**: [Solution]
**Expected Effect**: [Improvement]

[... 2 more suggestions ...]

## Rewrite Examples

### Before (problematic)
> [Quote original text]

### After (improved)
> [Rewritten version]

**Why this is better**: [Explanation]

## Article Strengths

1. [Excellent point 1]
2. [Excellent point 2]
3. [Excellent point 3]
```

## AI Considerations

### Evaluation principles
1. **Constructive** - Show path to improvement, not just criticism
2. **Specific** - Give concrete examples, not abstract feedback
3. **Practical** - Provide immediately actionable suggestions
4. **Empathetic** - Acknowledge author's effort
5. **Fair** - Evaluate both strengths and weaknesses without bias
6. **Preventive** - Catch controversy risks before publication
7. **Strict** - Don't inflate scores; 5.0 should be rare

### Key questions to consider
- Is the article focused on solving the reader's problem?
- Can you feel the author's learning and growth process?
- Does it provide value that only humans can write in the AI era?
- Would this survive "the most critical reader"?

### Improvement priority order
1. **Eliminate controversy risk** - Address first
2. **High-impact quick fixes** - Title, intro, headings
3. **Value-adding improvements** - Examples, visuals
4. **Long-term growth** - Style, voice development

## Notes

- The goal is accurate evaluation and specific suggestions, not high scores
- Use this before publishing to catch issues early
- For corporate blogs, apply stricter standards (one level down)
- If controversy risk is high, reconsider publication even if other scores are good
- Recommend "publish at 80%, iterate based on feedback" approach
- AI-assisted writing is fine; making it human and valuable is what matters

## Examples

### Basic evaluation
```text
/evaluate-article app/src/content/docs/tech/authentication-token-guide.mdx

Output:
# Authentication Token Guide Evaluation Report

## Evaluation Summary

- **Overall Score**: 3.6/5.0
- **Controversy Risk**: 4.5/5.0 (Low risk)
- **Human Authenticity**: 3.2/5.0

### Score by Category
---
Defensibility           ████████░░ 4.0/5.0
Logical Organization    ███████░░░ 3.5/5.0
Practical Applicability ████████░░ 4.0/5.0
Structure & Readability ███████░░░ 3.5/5.0
Communication           ██████░░░░ 3.0/5.0
---
Controversy Risk        █████████░ 4.5/5.0
Human Authenticity      ██████░░░░ 3.2/5.0
---

## Priority Improvement Suggestions TOP 3

### 1. Add personal experience or failure stories
**Current State**: Article is technically accurate but reads like documentation
**Suggestion**: Add a section about common mistakes you made or pitfalls you encountered
**Expected Effect**: +0.5 to Human Authenticity, +0.3 to Communication

[... continued ...]
```

## Related Commands
- `/astro-content`: Create new MDX content (use evaluate-article after creation)
- `/check-secrets`: Scan for secrets before publishing
- `/commit-push-pr`: Create PR after addressing evaluation feedback

## References
- Original evaluation framework: https://github.com/nwiizo/workspace_2026/tree/main/tools/blog_evaluation
- Detailed criteria in: `.claude/skills/evaluate-article/SKILL.md`
