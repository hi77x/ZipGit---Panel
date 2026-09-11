export type FuzzyMatch = { score: number; positions: number[] };

const separators = new Set(["/", "\\", "-", "_", ".", " ", ":", "@", "(", "["]);

export function fuzzyMatch(query: string, target: string): FuzzyMatch | null {
  const needle = query.trim().toLowerCase();
  if (!needle) return { score: 1, positions: [] };
  const haystack = target.toLowerCase();
  const positions: number[] = [];
  let score = 0;
  let index = -1;
  let previousMatch = -2;
  for (const char of needle) {
    index = haystack.indexOf(char, index + 1);
    if (index === -1) return null;
    positions.push(index);
    let bonus = 1;
    if (index === previousMatch + 1) bonus += 4;
    if (index === 0 || separators.has(haystack[index - 1] ?? "")) bonus += 6;
    if (target[index] === char.toUpperCase() && char !== char.toUpperCase()) bonus += 1;
    score += bonus;
    previousMatch = index;
  }
  score += Math.max(0, 12 - (target.length - needle.length) / 4);
  if (haystack === needle) score += 40;
  else if (haystack.startsWith(needle)) score += 18;
  else if (haystack.includes(needle)) score += 8;
  return { score, positions };
}

export type RankedItem<T> = { item: T; score: number; positions: number[] };

export function rankByFuzzy<T>(items: readonly T[], query: string, key: (item: T) => string, limit = 50): Array<RankedItem<T>> {
  const ranked: Array<RankedItem<T>> = [];
  for (const item of items) {
    const match = fuzzyMatch(query, key(item));
    if (match) ranked.push({ item, score: match.score, positions: match.positions });
  }
  ranked.sort((left, right) => right.score - left.score);
  return ranked.slice(0, limit);
}
