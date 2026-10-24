# Grading calibration

Measures how far the AI grader is from teachers on the same essays: does it
over-score, by how much, and is it stable when the same essay is graded again?

## 1. Collect gold essays

A gold essay is an essay with a grade you trust (a teacher's marking, or an
HKEAA sample script with its published level). Put one JSON file per essay
anywhere under `eval/gold/` (sub-folders are fine):

```json
{
  "id": "2025-s6-01",
  "source": "陳老師 2025-10 mock exam",
  "gradeLevel": "S6",
  "genre": "記敘抒情文",
  "taskPrompt": "那一次，我終於明白了……",
  "text": "全文……",
  "gold": {
    "dseLevel": "4",
    "scores": { "content": 24, "expression": 18, "structure": 12, "punctuation": 6 },
    "typoCount": 2
  }
}
```

`gold.dseLevel` is required. Set it to one of `U 1 2 3 4 5 5* 5**`. `gold.scores` and `typoCount` are
optional; with scores, the report also shows bias per criterion. A copyable
template is in `eval/example-gold.json`.

Teachers can also mark essays in the app (teacher submission page →
「老師覆核」). Export those reviews as gold essays with:

```bash
npm run eval:export-reviews
```

`eval/gold/` and `eval/results/` are git-ignored because they contain
students' essays. Keep them out of the repository.

## 2. Run the evaluation

```bash
npm run eval:grading -- --runs 3
```

Options: `--dir eval/gold`, `--runs 3`, `--concurrency 2`, `--limit N`,
`--out eval/results`. It uses the same model and prompt as production
(`ANALYSIS_MODEL` from `.env.local`), so it costs essays × runs analysis
calls.

## 3. Read the report

| Metric | Meaning | Aim for |
|---|---|---|
| Exact level agreement | AI median level equals the teacher's level | as high as possible |
| Within one level | AI is at most one level away | ≥ 90% |
| Mean level bias | average AI − teacher, in levels; positive = AI grades higher | close to 0 |
| AI higher / lower | share of essays the AI over- / under-grades | balanced |
| Quadratic weighted κ | agreement corrected for chance (1 = perfect) | ≥ 0.7 |
| Run-to-run score σ | how much the total moves between runs of one essay | small (≤ 3 points) |

A JSON report with per-essay results is written to `eval/results/`, named
after the prompt version, so you can compare prompt changes over time. Use
at least 30 essays across levels before trusting the numbers.
