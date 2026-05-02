/** 將教練回覆正文拆成 2–3 個氣泡，避免單一長文。導航 token 由呼叫端加回最後一則。 */

export function splitCoachBodyIntoChunks(body: string, maxChunks = 3): string[] {
  const t = body.trim();
  if (!t) return [];
  const paragraphs = t.split(/\n\n+/).map((s) => s.trim()).filter(Boolean);
  if (paragraphs.length >= 2 && paragraphs.length <= maxChunks) {
    return paragraphs.slice(0, maxChunks);
  }
  if (paragraphs.length > maxChunks) {
    const head = paragraphs.slice(0, maxChunks - 1);
    const tail = paragraphs.slice(maxChunks - 1).join("\n\n");
    return [...head, tail];
  }
  const sentences = t.split(/(?<=[。！？!?])\s*/).map((s) => s.trim()).filter(Boolean);
  if (sentences.length >= 2 && sentences.length <= maxChunks) {
    return sentences;
  }
  if (sentences.length > maxChunks) {
    const per = Math.ceil(sentences.length / maxChunks);
    const out: string[] = [];
    for (let i = 0; i < sentences.length; i += per) {
      out.push(sentences.slice(i, i + per).join(""));
      if (out.length >= maxChunks) break;
    }
    return out.slice(0, maxChunks);
  }
  if (t.length > 120 && maxChunks >= 2) {
    const mid = Math.floor(t.length / 2);
    const a = t.slice(0, mid).trim();
    const b = t.slice(mid).trim();
    return [a, b].filter(Boolean);
  }
  return [t];
}
