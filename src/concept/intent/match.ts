export function normalize(text: string) {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim().replace(/foot treatment/g, "foot care");
}

export function distance(a: string, b: string): number {
  if (a.length === b.length) {
    for (let i = 0; i < a.length - 1; i++) {
      if (a.slice(0, i) + a[i + 1] + a[i] + a.slice(i + 2) === b) return 1;
    }
  }
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
export function matchNames<T extends { id: string; name: string; aliases?: string[] }>(text: string, items: T[]): T[] {
  const words = normalize(text).split(" ");
  const scored = items.map((item) => {
    let score = 0;
    for (const label of [item.name, ...(item.aliases ?? [])]) {
      const name = normalize(label);
      for (const candidate of [name, ...name.split(" ")]) {
        const length = candidate.split(" ").length;
        for (let i = 0; i < words.length; i++) {
          const phrase = words.slice(i, i + length).join(" ");
          if (phrase === candidate || phrase === candidate + "s") score = Math.max(score, candidate === name ? 4 : 3);
          else if (candidate.length >= 4 && distance(phrase, candidate) === 1) score = Math.max(score, 1);
        }
      }
    }
    return { item, score };
  });
  const best = Math.max(0, ...scored.map((s) => s.score));
  return scored.filter((s) => best > 0 && s.score === best).map((s) => s.item);
}
