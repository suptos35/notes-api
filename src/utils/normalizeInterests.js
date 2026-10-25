/**
 * Normalizes user interests:
 * - Trims whitespace and converts to lowercase
 * - Filters out empty strings and items exceeding 30 characters
 * - Deduplicates entries
 * - Limits to a maximum of 10 items
 * 
 * @param {string[]} [interests=[]]
 * @returns {string[]}
 */
export function normalizeInterests(interests = []) {
  if (!Array.isArray(interests)) {
    return [];
  }

  const seen = new Set();
  const normalized = [];

  for (const item of interests) {
    if (typeof item !== 'string') continue;
    const clean = item.trim().toLowerCase();
    if (!clean || clean.length > 30) continue;
    if (!seen.has(clean)) {
      seen.add(clean);
      normalized.push(clean);
      if (normalized.length >= 10) break;
    }
  }

  return normalized;
}
