# Launch checklist (owner steps)

The repository is prepared for its public release (goal 13,
[OPEN_SOURCE_LAUNCH.md](OPEN_SOURCE_LAUNCH.md)). These steps are GitHub
settings and decisions that only Niclas makes; agents never change settings
or visibility. Do them in this order. Click paths are for github.com as of
November 2026; items marked **(verify)** may be worded differently in the
current UI or docs.

## Before going public

1. **Decide about the personal email in history.** 13 historical commits were
   authored (10 also committed) with a personal email address, and the history
   also still holds the raw evidence files removed from `docs/archive/` (Vercel
   preview URLs with the team slug, deployment IDs, local Windows paths). Once
   the repository is public, all of this is readable in the history.
   - **Accept:** do nothing. The email and old files stay visible in history.
   - **Rewrite once:** with your explicit yes, an agent runs `git filter-repo`
     on a fresh clone (`--mailmap` to replace the email with your no-reply
     address, and optionally `--invert-paths` for the removed evidence paths),
     then force-pushes every branch and tag. All commit SHAs change, open PRs
     must be recreated or rebased, every clone (yours and the agents') must be
     re-cloned, and SHAs quoted in docs no longer resolve. Do this before
     step 7 (going public), never after.
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
6. **Turn on Dependabot alerts.** **Settings** → **Advanced Security** (older
   UI: **Code security and analysis**) → **Dependabot alerts** → **Enable**.
   **(verify)** Also enable **Dependabot security updates** there.

## Go public

7. **Change visibility to Public.** **Settings** → **General** → **Danger
   Zone** → **Change repository visibility** → **Change to public** → read
   the warnings → confirm with the repository name.

## Right after publishing

These features are free for public repositories; some are only offered
once the repository is public.

8. **Private vulnerability reporting.** **Settings** → **Advanced Security**
   → **Private vulnerability reporting** → **Enable**. SECURITY.md, the issue
   config and the Code of Conduct all rely on it. While you are there, enable
   **Secret scanning** with **Push protection**, and **CodeQL analysis**
   (**Set up** → **Default**).
9. **Branch protection for `main`.** **Settings** → **Branches** → **Add
   classic branch protection rule** (or **Rules** → **Rulesets** → **New
   branch ruleset** **(verify)**) → Branch name pattern `main` →
   - tick **Require a pull request before merging**;
   - tick **Require status checks to pass before merging**, then search and
     add the checks from **Verify POC** (`E2E dev / proxy 0`) and **Secret
     scan** (`Gitleaks (full history)`). The checks only appear in the search
     after they have run once in the last week;
   - leave **Allow force pushes** and **Allow deletions** unticked;
   - **Create**.
   Note: Verify POC skips pull requests that only change docs or Markdown
   (`paths-ignore` in `verify.yml`), so a required Verify check would wait
   forever on such PRs. Either merge those as admin or ask an agent to make
   Verify POC always report a result.
10. **CLA Assistant.** Open <https://cla-assistant.io> → **Sign in with
    GitHub** → **Configure CLA** → choose this repository → link the CLA. CLA
    Assistant reads the text from a GitHub gist **(verify)**: create a public
    gist with the contents of `docs/legal/CLA.md` (individual and entity
    sections) and paste its URL. The CLA is still marked "Draft, pending
    legal review"; have it reviewed before you rely on it. The PR template
    already asks contributors to agree.
11. **Release v0.4.0.** Follow `docs/RELEASING.md` (move `[Unreleased]` in
    `CHANGELOG.md` to `[0.4.0]`, bump `package.json`, merge). Then **Releases**
    → **Draft a new release** → **Choose a tag** → type `v0.4.0` → **Create
    new tag on publish** (target `main`) → title `v0.4.0` → paste the
    changelog section as notes → attach the promo video → **Publish
    release**.
    - **Which video:** attach **v5**, whose music is generated in code by the
      video maker, together with the generator script that produced it. v5
      replaces v4 for the release assets and for social media; v4 with music
      is not used officially.
    - The repository copy (`docs/media/cresavo-tour-9x16.mp4`) stays silent.
12. **Check the public page.** Open the repository logged out (or in a
    private window): the README renders with badges, screenshots and the
    video poster; **Security** → **Report a vulnerability** is offered; the
    **New issue** button shows the bug and idea forms and the security link.
