# Launch checklist (owner steps)

The [open-source launch guide](OPEN_SOURCE_LAUNCH.md) summarizes the preparation. These steps are GitHub
settings and decisions that only Niclas makes; agents never change settings
or visibility. Do them in this order. Click paths are for github.com as of
November 2026; items marked **(verify)** may be worded differently in the
current UI or docs.

## Before going public

1. **Decide about what stays in history.** Once the repository is public,
   every earlier revision is readable. Still in history: 13 commits authored
   (10 also committed) with a personal email address; the raw evidence files
   removed from `docs/archive/` (Vercel preview URLs with the team slug,
   deployment IDs, local Windows paths); and the earlier, unredacted versions
   of the archive files that were redacted in place (the same URLs, IDs and
   paths, the surname, and machine-specific scratch paths).
   - **Accept:** do nothing. All of the above stays visible in history.
   - **Rewrite once:** with your explicit yes, an agent runs `git filter-repo`
     on a fresh mirror clone: `--mailmap` to replace the email with your
     no-reply address, `--invert-paths` for the removed evidence paths, and
     `--replace-text` with the same redaction patterns used on the tree, then
     checks every ref with gitleaks and the redaction patterns, and pushes
     every branch and tag with force. All commit SHAs change, open PRs must
     be recreated or rebased, every clone (yours and the agents') must be
     re-cloned, and SHAs quoted in docs no longer resolve. Do this before
     step 8 (going public), never after.
2. **Use the no-reply address for future commits.** Settings (your profile
   menu → **Settings**) → **Emails** → tick **Keep my email addresses
   private** and **Block command line pushes that expose my email**. Copy the
   `…@users.noreply.github.com` address shown there and run
   `git config --global user.email "<that address>"` on every machine you
   commit from.
3. **Merge PR #31.** **Pull requests** → **#31** → check the CI result →
   **Merge pull request** (create a merge commit) → **Confirm merge**.
4. **Description, website and topics.** Repository front page → the gear icon
   next to **About** →
   - Description: `Cresavo: a calm, open-source booking and business workspace for small service businesses. Concept demo with fictional data.`
   - Website: `https://demo.cresavo.com`
   - Topics: `booking`, `scheduling`, `salon`, `small-business`,
     `open-source`, `nextjs`, `typescript`, `mcp`, `agpl`
   - **Save changes**.
5. **Disable the wiki.** **Settings** → **General** → **Features** → untick
   **Wikis**.
6. **Delete the old pair-proof workflow runs.** Until 2026-11-18, the
   **Verify POC** workflow could be started by hand with a Git bundle of the
   private gateway's source as an input (removed now). Those 23 manual runs
   (event `workflow_dispatch`, 2026-11-12 to 2026-11-16) and their inputs
   become visible with the repository **(verify)**. **Actions** → **Verify
   POC** → filter **Event: workflow_dispatch** → for each run: **…** →
   **Delete workflow run**. An agent can list the run IDs for you.
7. **Turn on Dependabot alerts.** **Settings** → **Advanced Security** (older
   UI: **Code security and analysis**) → **Dependabot alerts** → **Enable**.
   **(verify)** Also enable **Dependabot security updates** there. Make sure
   **Dependency graph** is enabled: without it the `Dependency review` check
   fails with `403 Forbidden` (seen on PR #65, 2026-11-19).

## Go public

8. **Change visibility to Public.** **Settings** → **General** → **Danger
   Zone** → **Change repository visibility** → **Change to public** → read
   the warnings → confirm with the repository name.

## Right after publishing

These features are free for public repositories; some are only offered
once the repository is public.

9. **Private vulnerability reporting.** **Settings** → **Advanced Security**
   → **Private vulnerability reporting** → **Enable**. SECURITY.md, the issue
   config and the Code of Conduct all rely on it. **Secret scanning** and
   **Push protection** were confirmed enabled on 2026-11-19. Leave **CodeQL
   analysis** default setup **off**: CodeQL runs from `codeql.yml` (advanced
   setup), and both cannot be active at once.
10. **Branch protection for `main`.** **Settings** → **Branches** → **Add
   classic branch protection rule** (or **Rules** → **Rulesets** → **New
   branch ruleset** **(verify)**) → Branch name pattern `main` →
   - tick **Require a pull request before merging**;
   - tick **Require status checks to pass before merging**, then search and
     add the checks from **Verify POC** (`E2E dev / proxy 0`), **Secret
     scan** (`Gitleaks (full history)`), **Dependency review**
     (`Dependency review (high/critical gate)`) and **CodeQL**
     (`Analyze (javascript-typescript)`, `Analyze (actions)`). The checks
     only appear in the search after they have run once in the last week;
   - in a ruleset, also add **Require code scanning results** → tool
     **CodeQL** → security alerts **High or higher**, alerts **Errors**, so
     new CodeQL findings block merge and are not only reported **(verify)**;
   - leave **Allow force pushes** and **Allow deletions** unticked;
   - **Create**.
   Verify POC runs on every pull request, docs-only ones included, so the
   required check always reports.
11. **CLA Assistant (after legal review).** The CLA is a draft, and the
    README, CONTRIBUTING and the PR template say that signatures are not
    collected yet and external PRs are held for merge. When you are ready:
    have `docs/legal/CLA.md` and `TRADEMARK.md` reviewed; fill in the
    Maintainer's legal name, a version identifier and a private contact
    channel; then open <https://cla-assistant.io> → **Sign in with GitHub** →
    **Configure CLA** → choose this repository → link the CLA. CLA Assistant
    reads the text from a GitHub gist **(verify)**: create a public gist with
    the individual agreement and paste its URL; handle entity agreements
    privately, as the CLA describes. Then ask an agent to update the README,
    CONTRIBUTING and PR template wording and to remove the "Draft" labels.
12. **Release v0.4.0.** Follow `docs/RELEASING.md` (move `[Unreleased]` in
    `CHANGELOG.md` to `[0.4.0]`, bump `package.json`, merge). Then **Releases**
    → **Draft a new release** → **Choose a tag** → type `v0.4.0` → **Create
    new tag on publish** (target `main`) → title `v0.4.0` → paste the
    changelog section as notes → attach the promo video → **Publish
    release**.
    - **Which video:** attach **v5**, whose music is generated in code by the
      video maker, together with the generator script that produced it. v5
      replaces v4 for the release assets and for social media; v4 with music
      is not used officially.
    - v5 is delivered: 9:16 and 16:9, each with and without music. The
      repository holds a compressed 16:9 copy with music
      (`docs/media/cresavo-tour-16x9.mp4`) and the music generator
      (`scripts/media/promo-music.py`, MIT). Attach the four full-size
      files to the release.
13. **Before the waiting list opens** (not needed to go public): name the
    controller (your legal name or a company) and a private contact on
    `/privacy`, and follow the GDPR notes in [WAITLIST.md](WAITLIST.md).
14. **Offer the source on the demo.** Ask an agent to add a "Source code"
    link to this repository (pinned to the deployed commit) in the demo
    footer, so visitors of the network service are offered the
    Corresponding Source as the AGPL describes for modified versions.
15. **Check the public page.** Open the repository logged out (or in a
    private window): the README renders with badges, screenshots and the
    video poster; **Security** → **Report a vulnerability** is offered; the
    **New issue** button shows the bug and idea forms and the security link.
