import { createHash, timingSafeEqual } from "node:crypto";

/**
 * The shared secret in the vacancy board's URL (`/vacancies/<code>`).
 *
 * This page has no sign-in — the code IS the credential — so the check fails
 * closed: an unset or too-short code means nobody gets in, rather than the
 * board silently going public.
 */
export const MIN_CODE_LENGTH = 16;

export function isValidVacancyCode(candidate: string): boolean {
  const expected = process.env.VACANCY_LINK_CODE ?? "";
  if (expected.length < MIN_CODE_LENGTH) return false;
  // Compare fixed-width digests: timingSafeEqual throws on a length mismatch,
  // and bailing out early on length would itself leak the code's length.
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(candidate), digest(expected));
}
