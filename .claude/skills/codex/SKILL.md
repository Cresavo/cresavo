---
name: codex
description: Use OpenAI Codex CLI as a second model in this repo — code review of a branch or diff, adversarial QA, design critique from screenshots, or reading current docs on the web. Use when a task says "review with Codex", "ask Astra/Sol", "second opinion", or before merging a larger change.
---

# Codex as a second model

Codex (OpenAI's coding agent CLI) is our independent reviewer and design critic.
Claude builds; Codex checks. Never let the same model build and approve a change.

## Before you start

- `codex login status` must say "Logged in using ChatGPT". If it does not, stop
  and ask the owner to log in (`codex login --device-auth`). Never ask for, paste
  or store an API key or token.
- In a cloud container the login disappears when the container is recycled.
- Codex reads `AGENTS.md` itself, so the repo rules apply to it too.

## Pick the model and effort

| Task | Model | Effort |
|---|---|---|
| Routine code review, small diff | `gpt-6.2-sol` | `medium` |
| Larger branch or PR review, subtle regressions across components, security | `gpt-6.2-astra` | `high` |
| Everyday coding or a fix | `gpt-6.2-sol` | `medium` |
| Brand, layout and visual design critique | `gpt-6.2-astra` | `high` |
| Quick fact lookup in current docs | `gpt-6.2-sol` | `low` |

Set effort with `-c 'model_reasoning_effort="high"'`. Values: `low`, `medium`,
`high`, `xhigh`, `max`. Higher means slower and costlier, so use it on purpose.

## Recipes

Review a branch against main (preferred for PRs):

```bash
codex review --base main -c 'model="gpt-6.2-astra"' -c 'model_reasoning_effort="high"' \
  "Adversarial review. Rank findings High/Medium/Low with file:line, a concrete failure scenario and a fix. Skip style nits."
```

Other targets: `--uncommitted` (working tree) or `--commit <sha>`.

Free-form read-only task with a saved answer:

```bash
codex exec -m gpt-6.2-sol -c 'model_reasoning_effort="medium"' --sandbox read-only \
  --skip-git-repo-check -o "<scratchpad>/codex-answer.md" "<prompt>"
```

Design critique: attach real screenshots and don't just describe them.

```bash
codex exec -m gpt-6.2-astra -c 'model_reasoning_effort="high"' --sandbox read-only \
  --skip-git-repo-check -i today-desktop.png -i today-mobile.png \
  "Critique this studio screen at its rendered size for a salon owner: hierarchy, spacing, consistency, anything that looks AI-generated. Concrete fixes only."
```

Read current web docs: add `-c tools.web_search=true` to `codex exec`. Useful
when this container's network blocks a docs site.

Let Codex drive a browser or run tests (QA rounds) by letting the sandbox write
and reach localhost:
`--sandbox workspace-write -c sandbox_workspace_write.network_access=true`.
Run it in a separate `git worktree` so it cannot disturb other work.

## Writing the prompt

- State the deliverable, the constraints, and what counts as verified. Name the
  conventions and behaviour to keep.
- Point at files, commits or screenshots; don't paste big dumps.
- Ask for findings ranked High/Medium/Low with a reproducible scenario. Codex
  output is a claim, not a fact.
- Don't add blanket "be brief" instructions or steps it can infer.

## After Codex answers

1. Verify every finding against the code, or reproduce it, before acting.
   Discard the ones that are wrong and say why.
2. Fix High and Medium findings in small commits. File Low findings as GitHub
   issues labelled `finding`, or fix them when cheap.
3. Keep a record: a short "Resolution" line per finding in the PR description,
   not a new report file per review.
4. Write output files to your scratchpad, never into the repo by accident.
   Quote paths in shell redirects so a literal `$VAR` file cannot appear.
