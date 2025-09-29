import OpenAI from "openai";
import { Client as OpenSearch } from "@opensearch-project/opensearch";

const INDEX       = process.env.EXEMPLAR_INDEX ?? "exemplars";
const TEMPLATE_ID = process.env.TEMPLATE_ID    ?? "muc4-v1";
const OS_URL      = process.env.OPENSEARCH_URL ?? "http://opensearch:9200";
const MODEL       = process.env.EMBEDDING_MODEL ?? "text-embedding-3-large";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const os = new OpenSearch({ node: OS_URL });

function clampK(input?: number) {
  const n = Number.isFinite(input as number) ? Number(input) : 3;
  return Math.max(3, Math.min(11, n));
}

async function embed(text: string) {
  const resp = await openai.embeddings.create({
    model: MODEL,
    input: `templateId=${TEMPLATE_ID}\n${text}`
  });
  return resp.data[0].embedding;
}

export async function retrieveByText(text: string, kInput?: number) {
  const k = clampK(kInput);
  const vector = await embed(text);

  // k-NN inside query; filter outside (works with nmslib engine)
  const body: any = {
  size: k,
  query: {
    script_score: {
      // your normal filter goes here
      query: {
        bool: {
          filter: [{ term: { templateId: TEMPLATE_ID } }]
        }
      },
      // use the k-NN plugin's scorer
      script: {
        source: "knn_score",
        lang: "knn",
        params: {
          field: "embedding",          // your knn_vector field
          query_value: vector,         // number[] embedding
          space_type: "cosinesimil"    // matches your index mapping
        }
      }
    }
  },
  _source: ["id", "templateId", "transcript", "result"]
};


  console.log(JSON.stringify(body).slice(0, 400));

  const res = await os.search({ index: INDEX, body });
  const hits = (res as any).body?.hits?.hits ?? (res as any).hits?.hits ?? [];

  return hits.map((h: any) => ({
    id: h._id,
    score: h._score,
    ...h._source
  }));
}

/** CLI entry: npx ts-node src/scripts/demo-retrieve.ts "some text" 5 */
if (require.main === module) {
  const text = process.argv[2] ?? "Dummy text about a bombing near an embassy claimed by a group.";
  const kArg = process.argv[3] ? Number(process.argv[3]) : undefined;

  retrieveByText(text, kArg)
    .then((rows) => {
      console.log(`\nTop ${rows.length} results (k in [3..11]):`);
      for (const r of rows) {
        console.log(`- id=${r.id} score=${r.score?.toFixed(4)} templateId=${r.templateId}`);
        console.log(
          `  transcript: ${String(r.transcript).slice(0, 140).replace(/\s+/g, " ")}${
            r.transcript.length > 140 ? "..." : ""
          }`
        );
        console.log(`  result keys: ${Object.keys(r.result ?? {}).join(", ")}`);
      }
      console.log("");
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
