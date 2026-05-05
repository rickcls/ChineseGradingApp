# Current Marking Scheme Prompt Review

Date reviewed: 2026-05-05

## Short answer

The current system marks an article by asking the AI to act as a strict HKDSE Chinese Paper 2 writing examiner. It first makes a holistic DSE-level judgement, then assigns four component scores:

| Component | Max | Weight / role |
| --- | ---: | --- |
| 內容 | 40 | Content, task relevance, depth, materials, insight |
| 表達 | 30 | Wording, sentence control, fluency, style |
| 結構 | 20 | Organisation, paragraphing, development, transitions |
| 標點 | 10 | Punctuation accuracy and readability |

The four component scores are added into a `base_score` out of 100. A typo bonus may then be added:

| Typo count | Bonus |
| ---: | ---: |
| 0-1 | +3 |
| 2-4 | +2 |
| 5-7 | +1 |
| 8+ | +0 |

So the score shown to the student can be up to `103`, but the DSE level is based only on the base score before typo bonus.

## Where the prompt comes from

The live analysis prompt is built in:

- `src/lib/analysis.ts`
- `src/lib/rubric.ts`
- `src/lib/rubricGuide.ts`
- `dse-chinese-writing-rubric.md`

The current prompt version is:

```ts
v5-2026-04-enriched-revision-suggestions
```

`src/lib/rubricGuide.ts` loads `dse-chinese-writing-rubric.md` first. If that file is unavailable, it falls back to `DSE中文寫作評分.md`, then to an embedded fallback rubric.

## Marking sequence

### 1. The AI receives the examiner role

The system prompt tells the model to behave as a senior HKDSE Chinese Paper 2 writing examiner and a warm writing tutor. The important scoring attitude is strict and conservative:

- Most students should fall around Level 2-3.
- Level 4 is good.
- Level 5 is reserved for strong work.
- 5* and 5** should be rare.
- If unsure, the model is told to mark down rather than mark up.

### 2. The AI makes a holistic DSE-level judgement first

Before assigning numbers, the prompt tells the AI to read the whole article and choose one overall level:

```text
U / 1 / 2 / 3 / 4 / 5 / 5* / 5**
```

This is meant to stop the model from adding up isolated marks mechanically. The article should first be judged as a whole piece of writing.

### 3. The AI assigns four component scores

The user prompt then asks for JSON with these fields:

```json
{
  "dse_level": "...",
  "scores": {
    "content": 0,
    "expression": 0,
    "structure": 0,
    "punctuation": 0
  },
  "typo_count": 0,
  "word_count": 0
}
```

The expected score ranges are:

- `content`: 0-40
- `expression`: 0-30
- `structure`: 0-20
- `punctuation`: 0-10

These are already weighted scores. For example, content is not returned as 7/10; it is returned as something like 28/40.

### 4. Component marks are anchored to quality bands

The rubric defines quality bands for each component.

For content:

| Band | Score range |
| --- | ---: |
| 上 | 33-40 |
| 中上 | 25-32 |
| 中 | 17-24 |
| 下 | 0-16 |

For expression:

| Band | Score range |
| --- | ---: |
| 上 | 25-30 |
| 中上 | 19-24 |
| 中 | 13-18 |
| 下 | 0-12 |

For structure:

| Band | Score range |
| --- | ---: |
| 上 | 17-20 |
| 中上 | 13-16 |
| 中 | 9-12 |
| 下 | 0-8 |

For punctuation:

| Band | Score range |
| --- | ---: |
| 上 | 9-10 |
| 中上 | 7-8 |
| 中 | 4-6 |
| 下 | 0-3 |

The prompt maps these bands roughly to DSE levels:

- 上 -> Level 5 / 5* / 5**
- 中上 -> Level 4
- 中 -> Level 3
- 下 -> Level 1 / 2 / U

### 5. The base score determines the DSE level

After the AI returns JSON, the code adds the four scores:

```text
base_score = content + expression + structure + punctuation
```

Then it maps the base score to a DSE level:

| DSE level | Base score range |
| --- | ---: |
| 5** | 94-100 |
| 5* | 88-93 |
| 5 | 80-87 |
| 4 | 66-79 |
| 3 | 50-65 |
| 2 | 37-49 |
| 1 | 22-36 |
| U | 0-21 |

Important: this level is based on the base score only. The typo bonus does not move the article into a higher DSE level.

### 6. Typo bonus is added after the base score

The AI reports `typo_count`. If it does not, the code estimates typo count from flagged word errors. Then the system calculates:

```text
overall_score = min(103, base_score + typo_bonus)
```

Example:

```text
content = 25
expression = 20
structure = 13
punctuation = 7
base_score = 65
typo_count = 1
typo_bonus = 3
overall_score = 68
dse_level = Level 3
```

Even though the displayed score becomes 68, the DSE level remains Level 3 because the base score is 65.

## Built-in safeguards

### Conservative level selection

The prompt tells the AI to be strict. It specifically says that if the model is considering Level 5 or above, the article must have:

- deep or inspiring intent,
- appropriate and representative material selection,
- refined expression with flexible rhetoric and personal style.

If any one of these is missing, the prompt says the article should fall to Level 4 or below.

### Word count pressure

The prompt recommends at least 600 Chinese characters. It does not apply a fixed automatic word-count penalty, but it tells the AI to lower content and structure if the article is obviously too short to develop ideas properly.

### Structure cannot outrank content

The rubric says structure should not be higher than content when content is weak. The code also enforces this after the model responds.

For example:

```text
content = 20 / 40
maximum allowed structure = floor((20 / 40) * 20) = 10 / 20
```

If the AI returned `structure = 13`, the code would reduce it to `10`.

### Code clamps invalid scores

The code rounds and clamps every score into its valid range:

- content cannot go below 0 or above 40,
- expression cannot go below 0 or above 30,
- structure cannot go below 0 or above 20,
- punctuation cannot go below 0 or above 10.

### Lower level wins if model and score disagree

The model returns a holistic `dse_level`, but the code also derives a level from the final base score. If these disagree, the code keeps the lower level.

Example:

```text
model says: Level 4
base score maps to: Level 3
final dse_level: Level 3
```

This is another conservative safeguard.

## Feedback and annotations

The mark is not the only output. The AI must also provide:

- `coach_feedback`: 3-6 sentences, with the DSE level stated at the beginning.
- `strengths`: 3-5 concrete strengths.
- `revision_priorities`: 3-8 improvement priorities, ordered by impact.
- `errors`: evidence-based annotations with category, subcategory, source span, position, suggestion, severity, and confidence.

The prompt tells the AI not to rewrite the full essay. Examples should stay short:

- `example_after` should be one or two sentences, up to 90 Chinese characters.
- `example_fix` should only fix the highlighted phrase, up to 25 Chinese characters.

## Review observations

### 1. The prompt mixes 0-10 rubric language with weighted output scores

The markdown rubric says each item is first marked `0-10`, then converted:

- content: `N x 4`
- expression: `N x 3`
- structure: `N x 2`
- punctuation: `N x 1`

But the actual JSON prompt asks the AI to output weighted scores directly:

- content: `0-40`
- expression: `0-30`
- structure: `0-20`
- punctuation: `0-10`

This is workable, because `src/lib/rubric.ts` provides weighted score bands, but it creates a possible source of confusion. A cleaner prompt would explicitly say: "Use the 0-10 rubric as judgement guidance, but return the converted weighted marks."

### 2. Post-processing can change the final level without changing the feedback text

The code may lower the final `dse_level` after parsing if:

- the score-derived level is lower than the model's holistic level, or
- the structure score is reduced because it was too high compared with content.

However, the `coach_feedback` text is not rewritten after this adjustment. So there is a possible mismatch:

```text
final dse_level = Level 3
coach_feedback says = Level 4
```

The prompt asks the model to keep them consistent, but the code can still alter the final level afterwards.

### 3. Typo bonus can make the displayed score look like a higher level

The system intentionally prevents typo bonus from changing the DSE level. That is good. But students may see something like:

```text
overall_score = 68
dse_level = Level 3
```

Since 68 normally looks like Level 4 from the base-score table, the UI or feedback should make clear that the DSE level is based on `base_score`, not `overall_score`.

### 4. The prompt is stronger on strictness than on calibration examples

The prompt includes useful anchors for typical Level 3, Level 4, and Level 5 work. It could be even more stable if it included one or two compact sample scoring profiles, such as:

```text
Level 3 typical: content 21, expression 16, structure 10, punctuation 5 = 52
Level 4 typical: content 28, expression 21, structure 14, punctuation 7 = 70
```

That would reduce drift between holistic level and component marks.

## Bottom line

The marking system is mainly holistic-first and rubric-anchored. The AI judges the whole article, assigns weighted scores for content, expression, structure, and punctuation, then the code clamps the numbers, enforces structure not exceeding content proportionally, adds typo bonus, and conservatively derives the final DSE level from the lower of the model's level and the score-derived level.

The main thing to watch is consistency: because the code may adjust scores or level after the AI has written its feedback, the final displayed level can theoretically disagree with the wording in `coach_feedback`.
