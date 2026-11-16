# Goal prompts: how we work

A **goal** is a bounded objective that an agent (Claude Code or Codex) works on
until it is done, often overnight. One goal = one file here + one
GitHub issue with the label `goal` that links to the file.

## Flow

1. **Claude Code writes the goal file** (copy the template below) and creates the issue.
2. **Niclas starts the agent** and pastes: "Read AGENTS.md and run
   `docs/goals/<file>.md` until all done-criteria are met."
3. **The agent builds**, commits often, updates `docs/concept/PROGRESS.md`
   with screenshots and creates issues for everything it finds on the side.
4. **Grok/Claude review** and write findings as issues (or in
   `docs/concept/REVIEW.md`).
5. **Niclas looks** at PROGRESS and the screenshots and says what is good/bad.
6. The next goal is written. Repeat.

## Which model?

| Work | Claude Code | Codex |
|---|---|---|
| Long overnight goal, many steps | Opus | Strongest Codex model in the list, reasoning **high** (or highest) |
| Planning, architecture, review | Opus | Strongest model, reasoning high |
| Bounded build step, clear spec | Sonnet | Default model, reasoning medium |
| Small fixes from issues | Sonnet or Haiku | Fastest/cheapest model |
| Mechanical work (screenshots, renames, copy tweaks) | Haiku | Fastest/cheapest model |
| Hardest problems (demo → real engine, stuck bugs, final pre-demo review) | Fable, sparingly | Strongest model, highest reasoning |

Claude Code picks the model per subagent itself; the main session's model is
changed by Niclas with `/model`. Codex currently runs "terra".

Rule of thumb: put the expensive model on what is long and unclear, the cheap
one on what is short and clear. Model names change often, so pick from the list
by "strongest" or "fastest" rather than exact name.

## Side findings → issues

The agent does **not** fix things outside its goal (that makes goals drag on and
get messy). Instead an issue is created:

```bash
gh api repos/niclasvestlund-YT/booking-lab-se/issues \
  -f title="Short description" \
  -f body="Where: path/page. What: ... Suggestion: ... Found during: <goal file>" \
  -f "labels[]=finding" -f "labels[]=ux"
```

Labels: `finding` (always for side findings), plus `bug`, `ux`, `ai`, `demo`,
`later`, `goal`. If the agent lacks GitHub access: write the finding under
"Findings" in `docs/concept/PROGRESS.md` and Claude will raise it as an issue.

A later goal can be "beta of all issues labelled `finding` + `ux`".

## Template

```markdown
# Goal: <name>

**Issue:** #<nr> · **Branch:** <branch> · **Suggested model:** <see table>

## Goal
One or two sentences: what should Niclas be able to do/see when this is done?

## Read first
AGENTS.md, <1–3 relevant docs>. Nothing else unless needed.

## Steps (commit and push after each)
1. ...
2. ...

## Done when
- [ ] Concrete, verifiable criteria (page X shows Y, test Z green)
- [ ] lint, tsc, test and build green
- [ ] Screenshots 390 px + 1280 px in docs/concept/screens/
- [ ] PROGRESS.md updated: done, how to try, remaining

## Out of scope
What explicitly must not be done now. Side findings → issue.
```

## Goals

All goals are listed in order in **[QUEUE.md](QUEUE.md)**. Agents take the next
open goal themselves when one is done, and run a cleanup pass when the queue is empty.
