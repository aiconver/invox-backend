import { ProcessingType } from "@/db/models/enums"
import FormTemplate from "@/db/models/formTemplate"

function transformFields(fields: { name: string; type: string }[]) {
  const structure: Record<string, { type: string; required: boolean }> = {}
  for (const field of fields) {
    structure[field.name] = {
      type: field.type,
      required: true,
    }
  }
  return structure
}

export async function startOneTimeImportFormTemplate() {
  const existing = await FormTemplate.count()
  if (existing > 0) {
    console.log("📦 Form templates already exist. Skipping import.")
    return
  }

  const defaultProcessingType = ProcessingType.OneModelAllQuestion

  const templates = [
    {
      name: "Onboarding Checklist",
      department: "HR",
      processingType: defaultProcessingType,
      domainKnowledge: "Checklist to ensure a new employee has all onboarding steps completed.",
      structure: transformFields([
        { name: "employeeName", type: "text" },
        { name: "startDate", type: "date" },
        { name: "manager", type: "text" },
      ]),
    },
    {
      name: "Exit Interview",
      department: "HR",
      processingType: defaultProcessingType,
      domainKnowledge: "Standard form to collect feedback during an employee exit interview.",
      structure: transformFields([
        { name: "employeeId", type: "text" },
        { name: "reasonForLeaving", type: "text" },
        { name: "feedback", type: "textarea" },
      ]),
    },
    {
      name: "Client Visit Summary",
      department: "Sales",
      processingType: defaultProcessingType,
      domainKnowledge: "Captures key points from a client visit to track relationship progress.",
      structure: transformFields([
        { name: "clientName", type: "text" },
        { name: "visitDate", type: "date" },
        { name: "summary", type: "textarea" },
      ]),
    },
    {
      name: "Daily Operations Log",
      department: "Operations",
      processingType: defaultProcessingType,
      domainKnowledge: "Log sheet for shift leads to document operational issues and handovers.",
      structure: transformFields([
        { name: "shiftLead", type: "text" },
        { name: "issues", type: "textarea" },
      ]),
    },
    {
      name: "Delivery Confirmation",
      department: "Logistics",
      processingType: defaultProcessingType,
      domainKnowledge: "Used to confirm the successful delivery of goods and receiver details.",
      structure: transformFields([
        { name: "deliveryId", type: "text" },
        { name: "receivedBy", type: "text" },
        { name: "date", type: "date" },
      ]),
    },
  ]

  await FormTemplate.bulkCreate(templates)
  console.log(`✅ Imported ${templates.length} form templates across departments.`)
}
