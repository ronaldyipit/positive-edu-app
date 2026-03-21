const fs = require("fs");
const path = require("path");
const { PDFParse } = require("pdf-parse");

const pdfPath =
  process.env.RAG_PDF_PATH ||
  path.join(__dirname, "..", "..", "assets", "RAG", "Positive Education_ The Geelong Grammar School Journey --.pdf");
const outPath =
  process.env.RAG_CHUNKS_JSON_PATH || path.join(__dirname, "..", "rag", "geelong_chunks.json");
const chunkSize = Number(process.env.RAG_CHUNK_SIZE || 900);
const chunkOverlap = Number(process.env.RAG_CHUNK_OVERLAP || 180);

function normalizeText(s) {
  return String(s || "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitIntoChunks(text, size = 900, overlap = 180) {
  const t = normalizeText(text);
  if (!t) return [];
  const out = [];
  let start = 0;
  while (start < t.length) {
    const end = Math.min(t.length, start + size);
    out.push(t.slice(start, end));
    if (end >= t.length) break;
    start = Math.max(0, end - overlap);
  }
  return out;
}

async function main() {
  if (!fs.existsSync(pdfPath)) {
    throw new Error(`RAG PDF not found: ${pdfPath}`);
  }
  const buffer = fs.readFileSync(pdfPath);
  const parser = new PDFParse({ data: buffer });
  const data = await parser.getText();
  await parser.destroy();
  const chunks = splitIntoChunks(data?.text || "", chunkSize, chunkOverlap);

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({ source: path.basename(pdfPath), chunks }, null, 2), "utf8");
  console.log(`[RAG] Built chunks: ${chunks.length}`);
  console.log(`[RAG] Output: ${outPath}`);
}

main().catch((err) => {
  console.error("[RAG] Build failed:", err?.message || err);
  process.exit(1);
});

