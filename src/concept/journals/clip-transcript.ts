/** Words spoken after recording started, not the earlier draft in the text field. */
export function clipTranscript(spoken: string, prior: string): string | undefined {
  const text = spoken.trim();
  const start = prior.trim();
  if (!text) return undefined;
  const rest = start && (text === start || text.startsWith(`${start} `) || text.startsWith(start))
    ? text.slice(start.length).trim()
    : text;
  return rest || undefined;
}
