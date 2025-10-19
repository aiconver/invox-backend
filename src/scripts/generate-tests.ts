// src/scripts/generate-tests.ts
import fs from "node:fs";
import path from "node:path";
import { singleLlmAllField } from "../strategies/single-llm-all-field";
import { singleLlmOneField } from "../strategies/single-llm-one-field";
import { dualLlmAllField } from "../strategies/dual-llm-all-field";
import { multiLlmOneField } from "../strategies/multi-llm-one-field";

// --- fields used for extraction (same as your app) ---
type DynFieldType = "text" | "textarea" | "date" | "number" | "enum";
type DynField = {
  id: string;
  label: string;
  type: DynFieldType;
  required?: boolean;
  options?: string[];
  description?: string;
};

const FIELDS: DynField[] = [
  {
    "id": "incidentType",
    "label": "Incident Type",
    "type": "enum",
    "required": true,
    "options": ["ATTACK", "BOMBING", "KIDNAPPING", "ASSASSINATION", "ARSON", "HIJACKING", "OTHER"],
    "description": "Choose exactly ONE from: ATTACK, BOMBING, KIDNAPPING, ASSASSINATION, ARSON, HIJACKING, OTHER. Output the enum in UPPERCASE. Decision order (apply top-down): 1) Explosives ⇒ BOMBING. If any explosive device/substance is used/found/attempted (bomb, car/truck bomb, grenade, mine, dynamite, IED, 'explosive charge/device', 'blast', 'explosion'), pick BOMBING — even if a named person is killed. 2) Named targeted killing (no explosives) ⇒ ASSASSINATION. If a specific named person is intentionally killed by shooting/stabbing etc., pick ASSASSINATION. 3) Abduction/hostages ⇒ KIDNAPPING. (kidnap/abduct/'taken hostage'/'seized' people). 4) Vehicle/aircraft/ship seizure ⇒ HIJACKING. 5) Fire set as method ⇒ ARSON. (torched/set on fire/burned). 6) All other violent clashes/ambushes/shootings ⇒ ATTACK. (ambush, clash, firefight, shootout, machine-gunned, gunfire). 7) OTHER only if violent but none above fits. Synonym normalization (interpretation only, output enum): ambush/clash/firefight/shootout/shooting → ATTACK; grenade/mine/claymore/dynamite/IED/car bomb/truck bomb/explosives/blast → BOMBING; assassinated/assassination of/killed [NAME] (no explosives) → ASSASSINATION; kidnap/abduct/hostage/sequester → KIDNAPPING; hijack/commandeer/seize (vehicle/plane/ship) → HIJACKING; torched/set on fire/burned → ARSON."
  },
  {
    "id": "incidentDate",
    "label": "Incident Date",
    "type": "date",
    "description": "Return the event date of the current incident as YYYY-MM-DD, else null. Accept any explicit calendar form (e.g., '20 DEC 89', 'December 20, 1989', '20-12-1989', '20/12/89'). Relative dates ('yesterday', 'last night', 'on Monday') are allowed only if the article provides a dateline or report date from which you can resolve to an absolute calendar date; otherwise return null. If multiple dates appear, choose the one tied to the primary incident (closest to the action). Validate calendar (reject impossible dates)."
  },
  {
    "id": "incidentLocation",
    "label": "Incident Location",
    "type": "text",
    "description": "The place where the current incident occurred. Prefer the most specific place (neighborhood/town/city) and, if stated, append the country (e.g., 'LA PAZ, BOLIVIA'). If a facility is named with a place ('U.S. Embassy in LA PAZ'), return the place ('LA PAZ' or 'LA PAZ, BOLIVIA'), not the facility. If only country is explicit, return the country. If none is stated, return an empty string."
  },
  {
    "id": "incidentStage",
    "label": "Incident Stage",
    "type": "enum",
    "options": ["ACCOMPLISHED", "ATTEMPTED", "PLANNED", "FAILED", "THREATENED"],
    "description": "Stage of execution for the current incident. Choose exactly one in UPPERCASE, using these cues and precedence: ACCOMPLISHED (attack executed: device exploded; shots fired causing harm; kidnapping carried out; arson/fire set). FAILED (explicit failure/foiling: device defused or misfired; plot thwarted at execution point). ATTEMPTED (overt steps taken but not completed; e.g., planted/placed/approached, interrupted before effect, without explicit 'failed' wording). PLANNED (plot/plan discovered or described, no overt execution step). THREATENED (threats/communiqués only, no execution or attempt). Precedence: ACCOMPLISHED > FAILED > ATTEMPTED > PLANNED > THREATENED."
  },
  {
    "id": "perpetratorIndividual",
    "label": "Perpetrator Individuals",
    "type": "textarea",
    "description": "Comma-separated FULL personal names explicitly identified as perpetrators of the current incident (planted/placed/detonated bombs; shot/attacked; ordered/led the attack; claimed responsibility as individuals). Include only named persons. Exclude organizations, generic roles ('terrorists', 'attackers'), unnamed ranks, victims/witnesses, and people linked only to other incidents. Use names as written; deduplicate; no brackets or notes."
  },
  {
    "id": "perpetratorOrganization",
    "label": "Perpetrator Organizations",
    "type": "textarea",
    "description": "Comma-separated organization names explicitly tied to perpetrating the current incident (claimed responsibility or authorities explicitly blame/identify). Prefer the canonical short form if given (e.g., 'FMLN', 'FPMR'). Exclude individuals, generic labels ('terrorists', 'drug traffickers') unless the generic label is the only attribution (then leave empty). Deduplicate; use names as written."
  },
  {
    "id": "target",
    "label": "Target",
    "type": "textarea",
    "description": "List only the specific people, buildings, or institutions explicitly named as the intended target of the current incident (e.g., 'attack on X', 'bombed X', 'against X'). Do not infer from casualty locations. Do not include victims unless they are explicitly the intended target. If the text lacks an explicit target, leave empty. Deduplicate."
  },
  {
    "id": "victim",
    "label": "Victim",
    "type": "textarea",
    "description": "People explicitly identified as harmed, killed, injured, or taken hostage in the current incident. Use specific names when provided; otherwise use the explicit group description from the text ('six Jesuit priests'). Exclude perpetrators and historical victims from other incidents. Deduplicate; leave empty if unspecified."
  },
  {
    "id": "weapon",
    "label": "Weapon",
    "type": "textarea",
    "description": "Weapons or methods explicitly tied to the current incident. Include named types (pistol, rifle, grenade, mine, IED, car bomb, dynamite) and accepted generic terms when type is unspecified but explicit ('a bomb', 'explosives', 'explosive device'). Include quantities if stated ('300 kg of dynamite'). Exclude metaphorical weapons and unspecific mentions not tied to this incident. Comma-separated; deduplicate."
  }
]

type InRow =
  | { docid: string; doctext: string; templates?: any[] }
  | { id?: string; transcript?: string; templates?: any[] };

type OutRow = {
  id: string;
  meta: {
    model_id: string;
    timing: { duration_ms: number };
    error: string | null;
  };
  answers: {
    incidentType: string;
    incidentDate: string | null;
    incidentLocation: string;
    incidentStage: string;
    perpetratorIndividual: string[];
    perpetratorOrganization: string[];
    target: string[];
    victim: string[];
    weapon: string[];
  };
};
// Updated helper function to convert comma-separated strings to arrays
function toStringList(v: unknown): string[] {
  if (v == null) return [];
  
  // If it's already an array, clean and return
  if (Array.isArray(v)) {
    return v
      .map(String)
      .map(s => s.trim())
      .filter(s => s && s !== "-");
  }
  
  // If it's a string, split by comma
  if (typeof v === "string") {
    const trimmed = v.trim();
    if (!trimmed || trimmed === "-") return [];
    
    // Split by comma and clean each item
    return trimmed
      .split(",")
      .map(s => s.trim())
      .filter(s => s && s !== "-");
  }
  
  return [];
}

// Keep existing toEnum function
function toEnum(v: unknown, allowed: string[]): string {
  if (v == null) return "";
  const s = String(v).trim().toUpperCase();
  return allowed.includes(s) ? s : "";
}

async function run() {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3] ?? "test-output.json";
  const limitArg = process.argv[4] ? Number(process.argv[4]) : 100;

  if (!inputPath) {
    console.error("Usage: npx ts-node src/scripts/generate-tests.ts <input.json> [output.json] [limit=5]");
    process.exit(1);
  }

  const absIn = path.resolve(inputPath);
  const raw = fs.readFileSync(absIn, "utf8");
  const rows = JSON.parse(raw) as InRow[];
  const limit = Number.isFinite(limitArg) && limitArg! > 0 ? limitArg : 100;

  const out: OutRow[] = [];
  for (let i = 0; i < Math.min(limit, rows.length); i++) {
    const r = rows[i];
    const id = (r as any).docid ?? (r as any).id ?? `row_${i}`;
    const transcript =
      (r as any).doctext ??
      (r as any).transcript ??
      "";

    console.log(`[${i + 1}/${Math.min(limit, rows.length)}] ${id} …`);

    const started = Date.now();
    try {
      const res = await multiLlmOneField({
        oldTranscript: "",
        newTranscript: transcript,
        transcript,            // back-compat
        fields: FIELDS as any, // only id/type/options/required are used
        currentValues: {},     
        lang: "en",
        needFewshotExamples: true,
      } as any);

      const ms = Date.now() - started;
      const filled = res.filled || {};

      // 🚨 CRITICAL: Use toStringList instead of toArray for proper conversion
      const answers = {
        incidentType: toEnum(filled["incidentType"]?.value, 
          ["ATTACK", "BOMBING", "KIDNAPPING", "ASSASSINATION", "ARSON", "HIJACKING", "OTHER"]
        ),
        incidentDate:
          typeof filled["incidentDate"]?.value === "string" &&
          /^\d{4}-\d{2}-\d{2}$/.test(filled["incidentDate"]?.value)
            ? (filled["incidentDate"]!.value as string)
            : null,
        incidentLocation: String(filled["incidentLocation"]?.value ?? "").trim(),
        incidentStage: toEnum(
          filled["incidentStage"]?.value,
          ["ACCOMPLISHED", "ATTEMPTED", "PLANNED", "FAILED", "THREATENED"]
        ),
        perpetratorIndividual: toStringList(filled["perpetratorIndividual"]?.value),
        perpetratorOrganization: toStringList(filled["perpetratorOrganization"]?.value),
        target: toStringList(filled["target"]?.value),
        victim: toStringList(filled["victim"]?.value),
        weapon: toStringList(filled["weapon"]?.value),
      };

      out.push({
        id,
        meta: {
          model_id: res.model ?? "unknown-model",
          timing: { duration_ms: ms },
          error: null,
        },
        answers,
      });
    } catch (e: any) {
      const ms = Date.now() - started;
      console.error(`  ✖ failed: ${e?.message || e}`);
      out.push({
        id,
        meta: {
          model_id: "unknown-model",
          timing: { duration_ms: ms },
          error: String(e?.message || e),
        },
        answers: { 
          incidentType: "",
          incidentDate: null,
          incidentLocation: "",
          incidentStage: "",
          perpetratorIndividual: [],
          perpetratorOrganization: [],
          target: [],
          victim: [],
          weapon: [],
        },
      });
    }
  }

  const absOut = path.resolve(outputPath);
  fs.writeFileSync(absOut, JSON.stringify(out, null, 2), "utf8");
  console.log(`\n✓ wrote ${out.length} results to ${absOut}`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});