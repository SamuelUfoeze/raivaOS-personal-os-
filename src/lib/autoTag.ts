import { getEmbedding, cosineSimilarity } from "./ai";

const MIN_SIMILARITY = 0.3;
const MAX_SUGGESTIONS = 5;
const CACHE = new Map<string, number[]>();

async function getTagEmbedding(tag: string): Promise<number[]> {
  const key = tag.toLowerCase();
  if (CACHE.has(key)) return CACHE.get(key)!;
  const emb = await getEmbedding(key);
  CACHE.set(key, emb);
  return emb;
}

export async function suggestTags(
  title: string,
  content: string,
  knownTags: string[]
): Promise<string[]> {
  if (!knownTags.length) return [];
  const text = `${title} ${content}`.toLowerCase().trim();
  if (!text) return [];
  const textEmb = await getEmbedding(text);
  const scored = await Promise.all(
    knownTags.map(async (tag) => {
      const tagEmb = await getTagEmbedding(tag);
      return { tag, score: cosineSimilarity(textEmb, tagEmb) };
    })
  );
  return scored
    .filter((s) => s.score >= MIN_SIMILARITY)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_SUGGESTIONS)
    .map((s) => s.tag);
}

export function clearTagCache() {
  CACHE.clear();
}
