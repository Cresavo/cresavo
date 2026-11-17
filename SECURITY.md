# Security policy

## Reporting a vulnerability

Please report vulnerabilities **privately** using GitHub's private
vulnerability reporting: go to the repository's **Security** tab and choose
**Report a vulnerability**. Do not open a public issue, discussion or pull
request for a security problem.

Include what you found, how to reproduce it, and the impact you expect. Use
synthetic data only; do not access data that is not yours.

## Scope

In scope: the code in this repository, including the studio, customer
booking pages, `/api` routes, the MCP, A2A and agent endpoints, and the AI
task layer (for example prompt injection that makes an assistant act without
approval).

Out of scope: social engineering, denial-of-service by volume, findings that
need a compromised device, and third-party services we do not control.
The public demo uses fictional data only.

## What to expect (goals, not promises)

This is a small project. We aim to:

- acknowledge your report within 5 working days,
- give an initial assessment within 14 days,
- fix confirmed high-severity issues as quickly as we can and credit you in
  the release notes if you wish.

We do not offer a bug bounty at this stage.

## Supported versions

Only the latest release on `main` is supported while the project is in the
0.x concept stage.
