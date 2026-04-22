# GitHub Push Template

Use this whenever you want to commit and push your latest changes.

Only change the commit message line.

## Quick version

```bash
git status --short

git add .

git commit -m "YOUR COMMENT HERE"

git push origin main
```

## Safer version

Use this if you want to check what will be pushed before committing.

```bash
git status --short

git diff

git add .

git commit -m "YOUR COMMENT HERE"

git push origin main
```

## Example comments

```bash
git commit -m "fix OCR upload flow"
git commit -m "update analysis model settings"
git commit -m "improve multi-page scan recognition"
```

## Important note

Do not push secret files like `.env.local`.

If needed, check `.gitignore` first before running `git add .`.
