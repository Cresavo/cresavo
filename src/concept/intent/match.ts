export function normalize(text: string) {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = row[0]; row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const previous = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + Number(a[i - 1] !== b[j - 1]));
      diagonal = previous;
    }
  }
  return row[b.length];
}

/** Return all equally plausible matches so callers can ask instead of guessing. */
export function matchNames<T extends { id: string; name: string }>(text: string, items: T[]): T[] {
  const words = normalize(text).split(" ");
  const scored = items.map(item => {
    const name = normalize(item.name);
    const parts = name.split(" ");
    let score = 0;
    for (const candidate of [name, ...parts]) {
      for (let i = 0; i < words.length; i++) {
        const phrase = words.slice(i, i + candidate.split(" ").length).join(" ").replace(/s$/, "");
        if (phrase === candidate || words.slice(i, i + parts.length).join(" ") === name) score = Math.max(score, candidate === name ? 4 : 3);
        else if (candidate.length >= 4 && distance(phrase, candidate) === 1) score = Math.max(score, 1);
      }
    }
    return { item, score };
  });
  const best = Math.max(0, ...scored.map(item => item.score));
  return scored.filter(item => best > 0 && item.score === best).map(item => item.item);
}
