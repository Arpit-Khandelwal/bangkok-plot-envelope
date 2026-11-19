export type ParseResult =
  | { readonly ok: true; readonly value: number }
  | { readonly ok: false; readonly message: string };

export interface NumberRule {
  readonly min: number;
  readonly max: number;
  /** Shown in messages, e.g. "m". */
  readonly unit: string;
}

const NUMBER_PATTERN = /^-?\d+(\.\d+)?$/;

/** Parses what the user typed. Accepts "12", "12.5" and "1,200"; rejects anything else. */
export function parseBoundedNumber(text: string, rule: NumberRule): ParseResult {
  const cleaned = text.trim().replace(/,/g, '');
  const unit = rule.unit ? ` ${rule.unit}` : '';
  if (cleaned === '') return { ok: false, message: `Enter a number from ${rule.min} to ${rule.max}${unit}.` };
  if (!NUMBER_PATTERN.test(cleaned)) return { ok: false, message: `Use digits only, for example ${rule.min + 1}${unit}.` };
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return { ok: false, message: `Enter a number from ${rule.min} to ${rule.max}${unit}.` };
  if (value < rule.min) return { ok: false, message: `Must be at least ${rule.min}${unit}.` };
  if (value > rule.max) return { ok: false, message: `Must be at most ${rule.max}${unit}.` };
  return { ok: true, value };
}
