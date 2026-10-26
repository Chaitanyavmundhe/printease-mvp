import Fuse from "fuse.js";

// Search only the public centre list in memory. Codes and short tokens remain
// literal; typo tolerance is for names/areas, never prices or payment data.
export function scoreCentreSearch(records, tokens) {
  if (!tokens.length) return new Map(records.map(record => [record.centre, 0]));
  const index = new Fuse(records, {
    keys: ["fuzzyText"],
    includeScore: true,
    ignoreLocation: true,
    ignoreFieldNorm: true,
    ignoreDiacritics: true,
    threshold: 0.4,
  });
  const scores = records.map(() => 0);
  for (const token of tokens) {
    const approximate = new Map();
    if (token.length >= 3 && !/\d/.test(token)) {
      for (const match of index.search(token)) approximate.set(match.refIndex, 1 + match.score);
    }
    records.forEach((record, position) => {
      scores[position] += record.text.includes(token) ? 0 : (approximate.get(position) ?? Infinity);
    });
  }
  return new Map(records.flatMap((record, position) => Number.isFinite(scores[position])
    ? [[record.centre, scores[position]]]
    : []));
}
