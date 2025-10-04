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
    "description": "Choose exactly ONE category for the PRIMARY violent incident explicitly described in the NEW transcript text. Return one of the allowed values or leave empty if no incident is clearly present. Rules: • Use BOMBING only if the current incident explicitly mentions an explosive event/device (e.g., bomb, explosion, blast, car/truck bomb, dynamite, IED). • Use ARSON only if the text explicitly states fire was set (e.g., arson, set fire, torched, burned). • Use ASSASSINATION only for a targeted killing of a specific named person or if the text says 'assassination/assassinate'. Mass bombings do not count as assassination even if named people die. • Use KIDNAPPING only if the current incident explicitly says kidnap/abduct/hostage/hostages. • Use HIJACKING only if the text explicitly says hijack or seizure of a vehicle/aircraft/ship. • Use ATTACK for clear violent action (shooting, armed clash, ambush) when none of the above specific categories apply. • Use OTHER only if the incident is violent but fits none of the categories. Scope & tie-breaks: extract ONLY from the NEW transcript; ignore background or metaphorical uses (e.g., 'economic attack'); if multiple incidents appear, pick the primary one by (a) most detailed, else (b) most recent within the doc, else (c) headline/lead focus."
  },
  {
    "id": "incidentDate",
    "label": "Incident Date",
    "type": "date",
    "description":
      "Return the calendar date of the CURRENT incident as YYYY-MM-DD; otherwise null. Use the event date (when the violence occurred), NOT the report/publication date. Accept explicit calendar mentions only (e.g., '20 DEC 89' → 1989-12-20; '4 January 1990' → 1990-01-04). If a relative phrase is given without an absolute date (e.g., 'yesterday', 'last night'), return null. If multiple dates appear, choose the date for the primary incident. Perform calendar validation (e.g., 1989-11-31 is invalid → null)."
  },
  {
    "id": "incidentLocation",
    "label": "Incident Location",
    "type": "text",
    "description":
      "Place string for WHERE the CURRENT incident occurred, taken verbatim from the transcript. Prefer the most specific named place (city/town/neighborhood); include higher levels if present (e.g., 'LA PAZ, BOLIVIA'). If multiple locations appear, pick the one where the incident happened (not HQs, not past incidents, not background). If only a facility is named with a place (e.g., 'U.S. Embassy in LA PAZ'), return the place (e.g., 'LA PAZ' or 'LA PAZ, BOLIVIA')—do NOT use the facility name here. If only the country is given, return the country. If no explicit place is stated, return an empty string."
  },
  {
    "id": "incidentStage",
    "label": "Incident Stage",
    "type": "enum",
    "options": ["ACCOMPLISHED", "ATTEMPTED", "PLANNED", "FAILED", "THREATENED"],
    "description":
      "Stage of execution for the CURRENT incident. Choose exactly one, using these cues and precedence: ACCOMPLISHED (attack executed: device exploded; shots fired causing harm; kidnapping carried out; arson/fire set). FAILED (explicit failure/foiling: device defused or misfired; plot thwarted at execution point). ATTEMPTED (overt steps taken but not completed; e.g., planted/placed/approached, interrupted before effect, without explicit 'failed' wording). PLANNED (plot/plan discovered or described, no overt execution step). THREATENED (threats/communiqués only, no execution or attempt). Precedence when multiple are mentioned: ACCOMPLISHED > FAILED > ATTEMPTED > PLANNED > THREATENED."
  },
  {
    "id": "perpetratorIndividual",
    "label": "Perpetrator Individuals",
    "type": "textarea",
    "description": "Return a comma-separated list of FULL personal names explicitly identified as perpetrators of the CURRENT incident in the NEW transcript, or leave empty if none. Inclusion: people who planted/placed/detonated bombs, shot/attacked, ordered or led the attack, or were explicitly named as responsible. Government/military/police individuals may be included ONLY if the text explicitly states they perpetrated this incident. Exclusion: organizations (go to PerpOrg), generic terms (e.g., 'terrorists', 'attackers'), roles without names (e.g., 'a lieutenant'), victims/bystanders/arrests without explicit perpetration, historical suspects or people linked only to past incidents, and media/reporting sources. Formatting: provide names as written in the transcript (prefer full names like 'PABLO ESCOBAR GAVIRIA'), deduplicate, no brackets/notes, comma-separated string (not an array)."
  },
  {
    "id": "perpetratorOrganization",
    "label": "Perpetrator Organizations",
    "type": "textarea",
    "description": "Return a comma-separated list of organizations/groups explicitly tied to perpetrating the CURRENT incident in the NEW transcript, or leave empty if none. Inclusion: groups that claim responsibility or that authorities explicitly blame/identify for this incident (e.g., 'ZARATE WILLKA ARMED FORCES OF LIBERATION claimed the attack'). Prefer the canonical short form when both are given (e.g., 'FMLN', 'FPMR'). Exclusion: individuals (go to PerpInd), generic labels without a named org (e.g., 'terrorists', 'drug traffickers'), government forces unless explicitly stated as perpetrators, media/reporting outlets, and groups mentioned only in background/other incidents. Formatting: use the org names exactly as in the transcript (prefer short canonical alias when provided), deduplicate near-duplicates (keep the most specific/canonical form), comma-separated string (not an array)."
  },
  {
    "id": "target",
    "label": "Target",
    "type": "textarea",
    "description": "List ONLY the specific people, buildings, or institutions EXPLICITLY stated as the intended target of the CURRENT violent incident. CRITICAL RULES: 1. ONLY include entities explicitly named as targets using phrases like 'attack on X', 'bombed X', 'targeted X', 'against X', 'attack against X'. 2. NEVER infer targets from casualty locations or generic actions. 3. NEVER include victims here - victims go in Victim field. 4. ONLY include what was clearly the intended focus of the attack. 5. If the text says 'fired at them' or 'killed people' without naming a specific target, leave empty. 6. DO NOT include metaphorical targets or economic targets. Return empty if no explicit target is named for the current incident."
  },
  {
    "id": "victim",
    "label": "Victim",
    "type": "textarea",
    "description": "List ONLY people EXPLICITLY identified as directly harmed, killed, injured, or taken hostage in the CURRENT specific incident. CRITICAL RULES: 1. ONLY include individuals/groups explicitly stated as victims of violence in the current incident. 2. NEVER include people taken hostage who were not harmed - only include if killed, injured, or explicitly harmed. 3. NEVER include economic impacts, metaphorical harm, or general suffering. 4. NEVER include perpetrators. 5. ONLY use specific names when provided, otherwise use explicit descriptions from text. 6. If victims are mentioned generically without specific identification or harm, leave empty. 7. DO NOT include people from past incidents or historical context. Return empty if no explicit direct victims are named for the current incident."
  },
  {
    "id": "weapon",
    "label": "Weapon",
    "type": "textarea",
    "description": "List ONLY weapons or methods EXPLICITLY named in connection with the CURRENT violent incident. CRITICAL RULES: 1. ONLY include if the text explicitly names a specific weapon type used in the current incident (bomb, grenade, dynamite, pistol, rifle, machinegun, car bomb, etc.). 2. NEVER infer from verbs like 'explosion', 'fired', 'shot', 'attack' without specific weapon mention. 3. NEVER include metaphorical or hypothetical weapons. 4. NEVER include chemicals, substances, or methods used in economic sabotage, poisoning, or non-violent contexts. 5. Include specific quantities when mentioned (e.g., '300 kg of dynamite') but only if part of current incident. 6. DO NOT include generic terms like 'weapons', 'arms', 'ammunition', 'explosives' without specific types. 7. If the text mentions effects like 'explosion' but doesn't name the device, leave empty. Return empty if no explicit weapons are named for the current incident."
  }
];

// --- helpers ---
function toArray(v: unknown): string[] {
  if (v == null) return [];
  if (Array.isArray(v)) return v.map(String).map(s => s.trim()).filter(s => s && s !== "-");
  const s = String(v).trim();
  if (!s || s === "-") return [];
  return s.split(",").map(x => x.trim()).filter(t => t && t !== "-");
}

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
  const limitArg = process.argv[4] ? Number(process.argv[4]) : 20;

  if (!inputPath) {
    console.error("Usage: npx ts-node src/scripts/generate-tests.ts <input.json> [output.json] [limit=5]");
    process.exit(1);
  }

  const absIn = path.resolve(inputPath);
  const raw = fs.readFileSync(absIn, "utf8");
  const rows = JSON.parse(raw) as InRow[];
  const limit = Number.isFinite(limitArg) && limitArg! > 0 ? limitArg : 20;

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
      const res = await singleLlmAllField({
        oldTranscript: "",
        newTranscript: transcript,
        transcript,            // back-compat
        fields: FIELDS as any, // only id/type/options/required are used
        currentValues: {},     
        lang: "en",
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