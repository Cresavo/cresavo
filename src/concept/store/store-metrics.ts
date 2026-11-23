const WARN_DOCUMENT_BYTES = 1_000_000;
const ACT_DOCUMENT_BYTES = 2_000_000;
export const MAX_DOCUMENT_BYTES = 8_000_000;
export const DOCUMENT_SIZE_REFUSAL = "Document exceeds the 8 MB limit.";
const WARN_BOOKINGS = 5_000;
const ACT_APPLY_P95_MS = 50;
const SAMPLE_WINDOW = 100;

export function percentile(samples: readonly number[], fraction: number): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.ceil(sorted.length * fraction) - 1] ?? 0;
}

interface CommitSample {
  documentBytes: number;
  bookings: number;
  applyDurationMs: number;
}

/** Bounded process-local metrics, with no tenant identifiers or document contents. */
export class StoreMetrics {
  private readonly samples: number[] = [];
  private commits = 0;
  private warnings = 0;
  private actionsNeeded = 0;
  private sizeRefusals = 0;
  private failedEffectCount = 0;
  private last?: CommitSample;

  record(sample: CommitSample) {
    this.samples[this.commits % SAMPLE_WINDOW] = sample.applyDurationMs;
    this.commits++;
    this.last = sample;
    const { warn, act } = this.snapshot();
    if (warn) this.warnings++;
    if (act) this.actionsNeeded++;
  }

  refusedSize() {
    this.sizeRefusals++;
  }

  failedEffects(count: number) {
    this.failedEffectCount += count;
  }

  snapshot() {
    const applyP95Ms = percentile(this.samples, 0.95);
    const documentBytes = this.last?.documentBytes ?? 0;
    const bookings = this.last?.bookings ?? 0;
    return {
      commits: this.commits,
      warnings: this.warnings,
      actionsNeeded: this.actionsNeeded,
      sizeRefusals: this.sizeRefusals,
      failedEffects: this.failedEffectCount,
      documentBytes,
      bookings,
      applyDurationMs: this.last?.applyDurationMs ?? 0,
      applyP95Ms,
      warn: documentBytes >= WARN_DOCUMENT_BYTES || bookings >= WARN_BOOKINGS,
      act: documentBytes >= ACT_DOCUMENT_BYTES || applyP95Ms > ACT_APPLY_P95_MS,
    };
  }
}
