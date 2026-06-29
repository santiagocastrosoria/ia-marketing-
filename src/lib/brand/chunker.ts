const DEFAULT_CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 50;

export function chunkText(
  text: string,
  chunkSize = DEFAULT_CHUNK_SIZE
): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const paragraphs = normalized.split(/\n\n+/);
  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    if (current.length + para.length + 2 <= chunkSize) {
      current = current ? `${current}\n\n${para}` : para;
    } else {
      if (current) chunks.push(current);
      if (para.length <= chunkSize) {
        current = para;
      } else {
        const words = para.split(/\s+/);
        current = "";
        for (const word of words) {
          if ((current + " " + word).trim().length > chunkSize) {
            if (current) chunks.push(current.trim());
            current = word;
          } else {
            current = current ? `${current} ${word}` : word;
          }
        }
      }
    }
  }
  if (current) chunks.push(current);

  if (chunks.length <= 1) return chunks;

  return chunks.map((chunk, i) => {
    if (i === 0) return chunk;
    const prev = chunks[i - 1];
    const overlap = prev.slice(-CHUNK_OVERLAP);
    return `${overlap} ${chunk}`.trim();
  });
}
