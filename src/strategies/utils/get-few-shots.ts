// src/lib/retrieval/getFewShots.ts
import { embed } from "ai";
import { openai as openaiProvider } from "@ai-sdk/openai";
import { Client as OpenSearch } from "@opensearch-project/opensearch";
import type { FormTemplateField } from "@/types/fill-form";

const INDEX       = process.env.EXEMPLAR_INDEX   ?? "exemplars";
const TEMPLATE_ID = process.env.TEMPLATE_ID      ?? "muc4-v1";
const OS_URL      = process.env.OPENSEARCH_URL   ?? "http://opensearch:9200";
const MODEL       = process.env.EMBEDDING_MODEL  ?? "text-embedding-3-large";

// Keep examples short in the prompt.
const MAX_EXAMPLE_CHARS = Number(process.env.FEWSHOT_MAX_CHARS ?? 1200);

// Always skip the top-1 nearest neighbor (to avoid identical test doc leakage)
const SKIP_TOP = 1;

const os = new OpenSearch({ node: OS_URL });

type FewShot = {
  text: string;
  expected: Record<string, { value: unknown | null; evidence?: { transcriptSnippet?: string } }>;
};

// Return an integer k in [1..5]; default to 5 if not provided/invalid.
function clampK(n?: number) {
  const k = Math.floor(Number(n));
  if (!Number.isFinite(k) || k < 1) return 5;
  return Math.min(5, k);
}

async function embedForTemplate(text: string) {
  const { embedding } = await embed({
    model: openaiProvider.textEmbeddingModel(MODEL),
    value: `templateId=${TEMPLATE_ID}\n${text}`,
  });
  return embedding;
}

function toExpectedShape(
  fields: FormTemplateField[],
  rawResult: Record<string, unknown> | undefined | null
): FewShot["expected"] {
  const expected: FewShot["expected"] = {};
  for (const f of fields) {
    const v =
      rawResult && Object.prototype.hasOwnProperty.call(rawResult, f.id)
        ? (rawResult as any)[f.id]
        : null;
    expected[f.id] = { value: v ?? null };
  }
  return expected;
}

/**
 * Fetch k+1 neighbors, drop the first (closest), return the next k.
 */
export async function getFewShotsFromTranscript(
  transcript: string,
  fields: FormTemplateField[],
  kInput?: number
): Promise<FewShot[]> {
  const k = clampK(kInput);
  const vector = await embedForTemplate(transcript);

  const body: any = {
    size: k + SKIP_TOP, // ask for one extra
    query: {
      script_score: {
        query: {
          bool: {
            filter: [{ term: { templateId: TEMPLATE_ID } }],
          },
        },
        script: {
          source: "knn_score",
          lang: "knn",
          params: {
            field: "embedding",
            query_value: vector,
            space_type: "cosinesimil",
          },
        },
      },
    },
    _source: ["id", "templateId", "transcript", "result"],
  };

  const res = await os.search({ index: INDEX, body });
  const hits: any[] =
    (res as any).body?.hits?.hits ?? (res as any).hits?.hits ?? [];

  // Drop the top-1, keep up to k
  const chosen = hits.slice(SKIP_TOP, SKIP_TOP + k);

  return chosen.map((h: any) => {
    const fullText: string = h._source?.transcript ?? "";
    const text =
      fullText.length > MAX_EXAMPLE_CHARS
        ? fullText.slice(0, MAX_EXAMPLE_CHARS)
        : fullText;

    const expected = toExpectedShape(fields, h._source?.result);
    return { text, expected };
  });
}
