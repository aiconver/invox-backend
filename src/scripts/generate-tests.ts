// src/scripts/generate-tests.ts
import fs from "node:fs";
import path from "node:path";
import { singleLlmAllField } from "../strategies/single-llm-all-field";
import { singleLlmOneField } from "../strategies/single-llm-one-field";

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

const INCIDENT_OPTIONS = ["ATTACK", "BOMBING", "KIDNAPPING", "ASSASSINATION", "ARSON", "HIJACKING", "OTHER"];

const FIELDS: DynField[] = [
  {
    "id": "incident_type",
    "label": "Incident Type",
    "type": "enum",
    "required": true,
    "options": ["ATTACK", "BOMBING", "KIDNAPPING", "ASSASSINATION", "ARSON", "HIJACKING", "OTHER"],
    "description": "Select exactly ONE category based on explicit evidence from the CURRENT violent incident. CRITICAL RULES: • BOMBING: ONLY if 'bomb', 'explosion', 'dynamic', 'explosive', 'car bomb', or specific explosive device is explicitly mentioned in connection with the current incident. • ARSON: ONLY if 'fire', 'arson', 'burned', or 'set fire' is explicitly stated as part of the current attack. • ASSASSINATION: ONLY for targeted killings of specific named individuals where the text explicitly states it was an assassination. • KIDNAPPING: ONLY if 'kidnap', 'hostage', 'abduct' explicitly stated with current incident. • HIJACKING: ONLY if 'hijack', 'seizure of vehicle' explicitly stated. • ATTACK: general armed conflict when no specific above category fits. • OTHER: only if clearly violent but fits none above. DO NOT use categories for past incidents, metaphorical violence, or economic sabotage. If uncertain or no explicit violent incident described, leave empty."
  },
  {
    "id": "PerpInd",
    "label": "Perpetrator Individuals",
    "type": "textarea",
    "description": "List ONLY specific named individuals EXPLICITLY identified as direct perpetrators in the CURRENT violent incident. CRITICAL RULES: 1. ONLY include people explicitly named as performing violent acts in the current incident (e.g., 'X planted the bomb', 'Y led the attack', 'Z fired weapons'). 2. NEVER include organizations, groups, or collective names - those go in PerpOrg. 3. NEVER include generic terms like 'terrorists', 'gunmen', 'attackers' without specific names. 4. NEVER include people only mentioned in organizational roles without direct action in current incident. 5. NEVER include victims, bystanders, or people only mentioned as being arrested/investigated. 6. ONLY use full personal names (e.g., 'PABLO ESCOBAR GAVIRIA') not roles or descriptions. 7. If individuals are mentioned in historical context or for other incidents, DO NOT include. Return empty if no explicit perpetrator individuals are named for the current incident."
  },
  {
    "id": "PerpOrg", 
    "label": "Perpetrator Organizations",
    "type": "textarea",
    "description": "List ONLY specific organizations/groups EXPLICITLY identified as responsible for the CURRENT violent incident. CRITICAL RULES: 1. ONLY include groups explicitly named in connection with the current incident (e.g., 'FMLN claimed responsibility', 'police blame Group X', 'Zarate Willka group claimed the attack'). 2. NEVER include individual names - those go in PerpInd. 3. NEVER include generic terms like 'guerrillas', 'terrorists', 'gunmen', 'drug traffickers' without specific organization names. 4. NEVER include government forces, police, or military unless they are explicitly acting as perpetrators in the current incident. 5. ONLY use the canonical short names (e.g., 'FMLN' not 'Farabundo Marti National Liberation Front'). 6. DO NOT include media outlets, reporting organizations, or groups mentioned in historical context. 7. If organization is only suspected or investigated without explicit connection to current incident, DO NOT include. Return empty if no explicit perpetrator organizations are named for the current incident."
  },
  {
    "id": "Target",
    "label": "Target",
    "type": "textarea",
    "description": "List ONLY the specific people, buildings, or institutions EXPLICITLY stated as the intended target of the CURRENT violent incident. CRITICAL RULES: 1. ONLY include entities explicitly named as targets using phrases like 'attack on X', 'bombed X', 'targeted X', 'against X', 'attack against X'. 2. NEVER infer targets from casualty locations or generic actions. 3. NEVER include victims here - victims go in Victim field. 4. ONLY include what was clearly the intended focus of the attack. 5. If the text says 'fired at them' or 'killed people' without naming a specific target, leave empty. 6. DO NOT include metaphorical targets or economic targets. Return empty if no explicit target is named for the current incident."
  },
  {
    "id": "Victim",
    "label": "Victim",
    "type": "textarea",
    "description": "List ONLY people EXPLICITLY identified as directly harmed, killed, injured, or taken hostage in the CURRENT specific incident. CRITICAL RULES: 1. ONLY include individuals/groups explicitly stated as victims of violence in the current incident. 2. NEVER include people taken hostage who were not harmed - only include if killed, injured, or explicitly harmed. 3. NEVER include economic impacts, metaphorical harm, or general suffering. 4. NEVER include perpetrators. 5. ONLY use specific names when provided, otherwise use explicit descriptions from text. 6. If victims are mentioned generically without specific identification or harm, leave empty. 7. DO NOT include people from past incidents or historical context. Return empty if no explicit direct victims are named for the current incident."
  },
  {
    "id": "Weapon",
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
    incident_type: string;
    PerpInd: string[];
    PerpOrg: string[];
    Target: string[];
    Victim: string[];
    Weapon: string[];
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
      const res = await singleLlmOneField({
        oldTranscript: "",
        newTranscript: transcript,
        transcript,            // back-compat
        fields: FIELDS as any, // only id/type/options/required are used
        currentValues: {},     // start empty
        lang: "en",
      } as any);

      const ms = Date.now() - started;
      const filled = res.filled || {};

      // 🚨 CRITICAL: Use toStringList instead of toArray for proper conversion
      const answers = {
        incident_type: toEnum(filled["incident_type"]?.value, INCIDENT_OPTIONS),
        PerpInd: toStringList(filled["PerpInd"]?.value),
        PerpOrg: toStringList(filled["PerpOrg"]?.value),
        Target: toStringList(filled["Target"]?.value),
        Victim: toStringList(filled["Victim"]?.value),
        Weapon: toStringList(filled["Weapon"]?.value),
      };

      // Optional: Log for debugging
      if (process.env.DEBUG) {
        console.log(`  Raw values:`, {
          PerpInd: filled["PerpInd"]?.value,
          PerpOrg: filled["PerpOrg"]?.value,
        });
        console.log(`  Converted:`, {
          PerpInd: answers.PerpInd,
          PerpOrg: answers.PerpOrg,
        });
      }

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
          incident_type: "", 
          PerpInd: [], 
          PerpOrg: [], 
          Target: [], 
          Victim: [], 
          Weapon: [] 
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