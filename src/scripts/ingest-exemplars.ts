// scripts/ingest-exemplars.ts
import fs from "node:fs";
import path from "node:path";
import { embed } from "ai";
import { openai as openaiProvider } from "@ai-sdk/openai";
import { Client as OpenSearch } from "@opensearch-project/opensearch";

const INDEX = process.env.EXEMPLAR_INDEX ?? "exemplars";
const TEMPLATE_ID = process.env.TEMPLATE_ID ?? "muc4-v1";
const OS_URL = process.env.OPENSEARCH_URL ?? "http://opensearch:9200";
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL ?? "text-embedding-3-large";
const VECTOR_DIM = Number(process.env.VECTOR_DIM ?? 3072); // 3072 for text-embedding-3-large

const os = new OpenSearch({ node: OS_URL });

type ExemplarDoc = {
  id?: string;
  templateId: string;
  transcript: string;
  result: Record<string, any>;
  embedding: number[];
};

/** ---- 1) Ensure index exists with vector mapping ---- */
async function ensureIndex() {
  const exists = await os.indices.exists({ index: INDEX });
  // @ts-ignore OpenSearch client versions differ in return shapes
  const idxExists = !!(exists.body ?? exists);
  if (idxExists) return;

  // 1) Make the mapping object a literal (so string literals stay as-is)
    const body = {
    settings: {
        index: { knn: true, "knn.algo_param.ef_search": 100 }
    },
    mappings: {
        properties: {
        templateId: { type: "keyword" },
        transcript: { type: "text" },
        result:     { type: "object", enabled: true },
        embedding: {
            type: "knn_vector",
            dimension: VECTOR_DIM,
            method: {
            name: "hnsw",
            space_type: "cosinesimil",
            engine: "nmslib",
            parameters: { ef_construction: 128, m: 16 }
            }
        }
        }
    }
    } as const; // <-- ✨ important

    // 2) Cast the body when calling the client (bypass too-strict typings)
    await os.indices.create({ index: INDEX, body: body as any });

  console.log(`[index] created "${INDEX}" (dim=${VECTOR_DIM}, cosine)`);
}

/** ---- 2) Load your JSON file(s) ----
 * Accepts:
 *  - MUC4-like: [{ docid, doctext, templates: [{...}] }, ...]
 *  - Or generic: [{ id?, transcript, result }, ...]
 */
function loadRecords(filePath: string): Array<any> {
  const abs = path.resolve(filePath);
  const raw = fs.readFileSync(abs, "utf8");
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) throw new Error("Input JSON must be an array");
  return data;
}

/** ---- 3) Normalize a record to {id, transcript, result} ---- */
function normalizeRecord(r: any): { id?: string; transcript: string; result: any } {
  // If already in the shape you want:
  if (r.transcript && r.result) return { id: r.id, transcript: r.transcript, result: r.result };

  // MUC-4 style fallback: doctext + templates[0]
  if (r.doctext && Array.isArray(r.templates)) {
    const tpl = r.templates[0] ?? {};
    return {
      id: r.docid,
      transcript: r.doctext,
      result: tpl
    };
  }
  throw new Error("Record shape not recognized. Provide transcript/result or MUC4 fields.");
}


/** ---- 4) Get an embedding for a transcript (AI SDK) ---- */
async function embedTranscript(transcript: string) {
  const { embedding } = await embed({
    model: openaiProvider.textEmbeddingModel(EMBEDDING_MODEL), // e.g. "text-embedding-3-small" or "text-embedding-3-large"
    value: `templateId=${TEMPLATE_ID}\n${transcript}`,
  });
  return embedding;
}


/** ---- 5) Bulk index documents ---- */
async function bulkIndex(docs: ExemplarDoc[]) {
  const ops: any[] = [];
  for (const d of docs) {
    ops.push({ index: { _index: INDEX, _id: d.id } });
    ops.push(d);
  }
  const res = await os.bulk({ index: INDEX, refresh: true, body: ops });
  // @ts-ignore
  if (res.body?.errors || res.errors) {
    console.error(res.body ?? res);
    throw new Error("Bulk indexing reported errors");
  }
  console.log(`[bulk] indexed ${docs.length} docs into "${INDEX}"`);
}

/** ---- 6) Main: file path via CLI ---- */
async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: ts-node scripts/ingest-exemplars.ts <path-to.json>");
    process.exit(1);
  }

  await ensureIndex();

  const rows = loadRecords(file);
  console.log(`[ingest] loaded ${rows.length} records from ${file}`);

  // Small, polite concurrency (avoid rate limits)
  const concurrency = Number(process.env.EMBED_CONCURRENCY ?? 4);
  let i = 0;
  const out: ExemplarDoc[] = [];

  async function work(r: any) {
    const { id, transcript, result } = normalizeRecord(r);
    const embedding = await embedTranscript(transcript);
    out.push({ id, templateId: TEMPLATE_ID, transcript, result, embedding });
    const n = ++i;
    if (n % 25 === 0) console.log(`  embedded ${n}/${rows.length}...`);
  }

  // Simple concurrency control
  const queue = [...rows];
  const workers = Array.from({ length: concurrency }, async () => {
    while (queue.length) {
      const r = queue.shift();
      if (r) await work(r);
    }
  });
  await Promise.all(workers);

  await bulkIndex(out);
  console.log("[done] OpenSearch now contains your exemplars.");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
