# Security policy

## Reporting a vulnerability

Please report vulnerabilities **privately** through GitHub Security
Advisories (private vulnerability reporting): go to the repository's
**Security** tab, choose **Report a vulnerability**, or open
<https://github.com/Cresavo/cresavo/security/advisories/new>.
The report starts privately on GitHub: you, the people with the relevant
permissions on this repository and anyone invited to the advisory can see it,
and we can discuss and fix it there before anything is public. Include only
the details needed to investigate. Do not open a public issue, discussion or pull
request for a security problem, and do not send reports by email.

Include what you found, how to reproduce it, and the impact you expect. Use
synthetic data only; do not access data that is not yours.

## Coordinated disclosure

Please give us a reasonable time to fix a problem before you disclose it
publicly. We will agree on a disclosure date with you in the private advisory.
If you act in good faith, follow this policy and use only synthetic data, we
will not pursue action against you for the research.

Issues in the standalone gateway belong to
[`Cresavo/gateway`](https://github.com/Cresavo/gateway); report them there the
same way.

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

Cresavo is a concept demo in the 0.x stage and is not production-ready. Only
the latest release receives security fixes; fixes land on `main` and ship in
the next release.

| Version | Supported |
|---|---|
| Latest 0.x release and `main` | Yes |
| Older 0.x releases | No |

Do not use Cresavo with real customer data yet; see
[docs/QUALITY_SECURITY.md](docs/QUALITY_SECURITY.md).
