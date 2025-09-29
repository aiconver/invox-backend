// src/scripts/generate-tests.ts
import fs from "node:fs";
import path from "node:path";
import { singleLlmAllField } from "../strategies/single-llm-all-field";

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
    "description": "Select exactly one category that best summarizes the event. Use domain intuition to pick the primary act (not every sub-act). • BOMBING: use when an explosive device detonated (IED, grenade, car bomb, mine, etc.). • ARSON: deliberate setting of fire without an explicit explosive device. • ASSASSINATION: targeted killing of a specific individual (political, military, civic). • KIDNAPPING: abduction, hostage-taking, detention by perpetrators. • HIJACKING: seizure of a vehicle/aircraft/vessel. • ATTACK: general armed attack (shooting, shelling, ambush, clashes) that doesn’t clearly fit the above. • OTHER: clearly violent incident that fits none of the categories. If multiple acts occur, choose the **most salient** one (e.g., bomb detonation during a broader clash → BOMBING). Keep the value exactly as one of the options (UPPERCASE)."
  },
  {
    "id": "PerpInd",
    "label": "Perpetrator Individuals",
    "type": "textarea",
    "description": "List the **individual people** suspected of, responsible for, or claiming the incident. Use one item per person, separated by commas. Use canonical personal names: “First Last” (e.g., \"Juan Pérez\"). Keep original diacritics and capitalization. **Do include** known aliases in parentheses if mentioned (e.g., \"Roberto d’Aubuisson (alias Roberto)\") only when helpful for disambiguation. **Do not include** titles/ranks (Col., Gen.), roles (Minister), or organizations here; those belong in PerpOrg. If only a role is given without a name (e.g., \"an army captain\"), leave this field empty. If perpetrators are unknown or only described as a crowd/mob, leave empty. Examples: \"Ignacio X.\", \"John Doe\"."
  },
  {
    "id": "PerpOrg",
    "label": "Perpetrator Organizations",
    "type": "textarea",
    "description": "List the **organizations or groups** suspected of, responsible for, or claiming the incident. Separate multiple entries with commas. Use the group’s canonical short name if present (e.g., \"FMLN\", \"ERP\"). Normalize dotted acronyms to plain uppercase (e.g., \"F.M.L.N.\" → \"FMLN\"). If there is **competing attribution** (e.g., police blame Group A; Group B denies), include all named groups mentioned. If a subgroup is specified, use the most specific label given (e.g., \"FMLN – Radio Venceremos\" → \"FMLN\"). Do **not** list state forces unless they are explicitly acting as perpetrators (e.g., death squads tied to security forces). If perpetrators are unknown or only described generically (\"guerrillas\", \"paramilitaries\" without a name), leave empty."
  },
  {
    "id": "Target",
    "label": "Target",
    "type": "textarea",
    "description": "List the **intended target(s)** of the attack—people, institutions, facilities, or assets the perpetrators aimed at. Separate multiple entries with commas. Use concise, specific noun phrases: e.g., \"UCA campus\", \"Power lines\", \"National Guard convoy\", \"U.S. Embassy\", \"Treasury Police outpost\", \"Electrical substation\", \"Bus carrying soldiers\". **Do not** put victim names here (those go to Victim). **Do not** put weapons or methods here. If unclear whether an object was targeted or incidental, omit it. Prefer concrete entities over broad areas (\"San Miguel\" is too broad unless the city itself was the target)."
  },
  {
    "id": "Victim",
    "label": "Victim",
    "type": "textarea",
    "description": "List those **harmed, killed, or directly threatened**. Separate with commas. Accept both **individual names** (\"Ignacio Ellacuría\") and **category labels** when names aren’t given (\"Civilians\", \"Jesuit priests\", \"University student\", \"National Guard soldiers\"). Include role descriptors when they uniquely identify the victim group (\"UCA director\", \"UCA human rights institute director\"). **Do not** list organizations here unless the organization itself suffered as a corporate entity (those belong in Target). Avoid duplicates (e.g., if both \"Priests\" and specific priest names are present, keep the most informative items). If no victims are reported, leave empty."
  },
  {
    "id": "Weapon",
    "label": "Weapon",
    "type": "textarea",
    "description": "List the **weapons or methods** used. Separate multiple entries with commas. Use clear, generic names unless a specific model is given. Examples: \"Bomb\", \"Grenade\", \"RPG-7\", \"AK-47\", \"Firearms\", \"Explosive device\", \"Land mine\", \"Arson\", \"Molotov cocktail\". Prefer the **specific model** when explicitly stated (\"RPG-7\" rather than \"Rocket launcher\"). If the account only mentions effects (\"explosion\", \"blast\") without naming the device, use \"Explosive device\". **Do not** include places, targets, or perpetrator names here. If unknown, leave empty."
  }
]
;

// --- helpers ---
function toArray(v: unknown): string[] {
  if (v == null) return [];
  if (Array.isArray(v)) return v.map(String).map(s => s.trim()).filter(s => s && s !== "-");
  const s = String(v).trim();
  if (!s || s === "-") return [];
  return s.split(",").map(x => x.trim()).filter(t => t && t !== "-");
}

// normalize enum to allowed values or empty string
function toEnum(v: unknown, allowed: string[]): string {
  if (v == null) return "";
  const s = String(v).trim().toUpperCase();
  return allowed.includes(s) ? s : "";
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

async function run() {
  const inputPath  = process.argv[2];
  const outputPath = process.argv[3] ?? "test-output.json";
  const limitArg   = process.argv[4] ? Number(process.argv[4]) : 5;

  if (!inputPath) {
    console.error("Usage: npx ts-node src/scripts/generate-tests.ts <input.json> [output.json] [limit=5]");
    process.exit(1);
  }

  const absIn  = path.resolve(inputPath);
  const raw    = fs.readFileSync(absIn, "utf8");
  const rows   = JSON.parse(raw) as InRow[];
  const limit  = Number.isFinite(limitArg) && limitArg! > 0 ? limitArg : 5;

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
        currentValues: {},     // start empty
        lang: "en",
      } as any);

      const ms = Date.now() - started;
      const filled = res.filled || {};

      const answers = {
        incident_type: toEnum(filled["incident_type"]?.value, INCIDENT_OPTIONS),
        PerpInd: toArray(filled["PerpInd"]?.value),
        PerpOrg: toArray(filled["PerpOrg"]?.value),
        Target:  toArray(filled["Target"]?.value),
        Victim:  toArray(filled["Victim"]?.value),
        Weapon:  toArray(filled["Weapon"]?.value),
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
        answers: { incident_type: "", PerpInd: [], PerpOrg: [], Target: [], Victim: [], Weapon: [] },
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
