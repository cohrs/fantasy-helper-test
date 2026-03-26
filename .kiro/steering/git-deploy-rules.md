---
inclusion: auto
---

# Git & Deployment Rules

## NEVER do these without explicit user approval in the current message:
- `git commit` — always ask first, show what's being committed
- `git push` — always ask first, confirm branch and remote
- `git merge` — always ask first, confirm source and target branches
- `git rebase` — always ask first
- Any `vercel` CLI command — NEVER run vercel deploy, vercel env, or any vercel CLI command. Deployments happen through Git integration only.
- Any `npx vercel` command — same as above, absolutely forbidden

## When user approves git operations:
- Execute them promptly, don't re-ask
- If something fails, explain what happened and ask before retrying

## Production URL
- The production site is: https://fantasy-helper-test.vercel.app
- Deployments to production happen automatically when code is pushed to `main`
- Preview deployments on Hobby plan require Vercel auth (not publicly accessible)
