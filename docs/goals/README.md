# Goal-promptar: så jobbar vi

Ett **goal** är ett avgränsat mål som en agent (Claude Code eller Codex) jobbar
med tills det är klart, ofta över natten. Ett goal = en fil här + ett
GitHub-issue med etiketten `goal` som länkar till filen.

## Flöde

1. **Claude Code skriver goal-filen** (kopiera mallen nedan) och skapar issuet.
2. **Niclas startar agenten** och klistrar in: "Läs AGENTS.md och kör
   `docs/goals/<fil>.md` tills alla klart-kriterier är uppfyllda."
3. **Agenten bygger**, commitar ofta, uppdaterar `docs/concept/PROGRESS.md`
   med skärmbilder och skapar issues för allt den hittar vid sidan om.
4. **Grok/Claude granskar** och skriver fynd som issues (eller i
   `docs/concept/REVIEW.md`).
5. **Niclas tittar** på PROGRESS och skärmbilderna och säger vad som är bra/dåligt.
6. Nästa goal skrivs. Upprepa.

## Vilken modell?

| Arbete | Claude Code | Codex |
|---|---|---|
| Långt goal över natten, många steg | Opus | Starkaste Codex-modellen i listan, reasoning **high** (eller högsta) |
| Planering, arkitektur, granskning | Opus | Starkaste modellen, reasoning high |
| Avgränsat byggsteg, tydlig spec | Sonnet | Standardmodellen, reasoning medium |
| Småfixar från issues | Sonnet eller Haiku | Snabbaste/billigaste modellen |

Tumregel: lägg den dyra modellen på det som är långt och oklart, den billiga
på det som är kort och tydligt. Modellnamnen ändras ofta, så välj i listan
utifrån "starkast" eller "snabbast" snarare än exakt namn.

## Fynd vid sidan om → issues

Agenten fixar **inte** saker utanför sitt goal (det gör att goals drar ut och
blir röriga). I stället skapas ett issue:

```bash
gh api repos/niclasvestlund-YT/booking-lab-se/issues \
  -f title="Kort beskrivning" \
  -f body="Var: sökväg/sida. Vad: ... Förslag: ... Hittat under: <goal-fil>" \
  -f "labels[]=fynd" -f "labels[]=ux"
```

Etiketter: `fynd` (alltid för sidofynd), plus `bug`, `ux`, `ai`, `demo`,
`senare`, `goal`. Saknar agenten GitHub-åtkomst: skriv fyndet under
"Fynd" i `docs/concept/PROGRESS.md` så tar Claude upp det som issue.

Ett senare goal kan vara "beta av alla issues med etiketten `fynd` + `ux`".

## Mall

```markdown
# Goal: <namn>

**Issue:** #<nr> · **Gren:** <gren> · **Föreslagen modell:** <se tabell>

## Mål
En eller två meningar: vad ska Niclas kunna göra/se när det är klart?

## Läs först
AGENTS.md, <1–3 relevanta docs>. Inget annat om det inte behövs.

## Steg (commita och pusha efter varje)
1. ...
2. ...

## Klart när
- [ ] Konkreta, kontrollerbara kriterier (sida X visar Y, test Z grönt)
- [ ] lint, tsc, test och build gröna
- [ ] Skärmbilder 390 px + 1280 px i docs/concept/screens/
- [ ] PROGRESS.md uppdaterad: klart, hur man provar, kvar

## Utanför målet
Det som uttryckligen inte ska göras nu. Sidofynd → issue.
```

## Goals

Alla goals står i ordning i **[QUEUE.md](QUEUE.md)**. Agenter tar nästa
lediga goal själva när ett är klart, och kör städpass när kön är tom.
