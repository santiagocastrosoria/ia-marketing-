import type { BrandKnowledgeChunk } from "@/lib/types/brand";

export interface RetrievalResult {
  chunks: BrandKnowledgeChunk[];
  mode: "keyword" | "embedding";
  scores: { chunkId: string; score: number }[];
}

/**
 * Mock retrieval via keyword overlap. Replace with vector search when embeddings are enabled.
 */
export function retrieveByKeywords(
  query: string,
  chunks: BrandKnowledgeChunk[],
  limit = 5
): RetrievalResult {
  const queryTerms = tokenize(query);
  if (queryTerms.length === 0) {
    return { chunks: chunks.slice(0, limit), mode: "keyword", scores: [] };
  }

  const scored = chunks
    .map((chunk) => {
      const chunkTerms = tokenize(chunk.chunk_text);
      const overlap = queryTerms.filter((t) => chunkTerms.includes(t)).length;
      const score = overlap / queryTerms.length;
      return { chunk, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return {
    chunks: scored.map((s) => s.chunk),
    mode: "keyword",
    scores: scored.map((s) => ({ chunkId: s.chunk.id, score: s.score })),
  };
}

/**
 * Future: vector similarity search using stored embeddings.
 */
export function retrieveByEmbedding(
  _queryEmbedding: number[],
  chunks: BrandKnowledgeChunk[],
  limit = 5
): RetrievalResult {
  const withEmbeddings = chunks.filter(
    (c) => c.embedding && c.embedding.length > 0
  );
  if (withEmbeddings.length === 0) {
    return { chunks: [], mode: "embedding", scores: [] };
  }
  // Placeholder for pgvector / OpenAI embeddings integration
  return { chunks: withEmbeddings.slice(0, limit), mode: "embedding", scores: [] };
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9áéíóúñ]+/)
    .filter((t) => t.length > 2);
}

export function extractKeywordsFromText(text: string, limit = 15): string[] {
  const tokens = tokenize(text);
  const freq = new Map<string, number>();
  for (const t of tokens) {
    freq.set(t, (freq.get(t) ?? 0) + 1);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word);
}
