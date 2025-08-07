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
        { name: "Full Name of Employee", type: "text" },
        { name: "Official Start Date", type: "date" },
        { name: "Assigned Manager's Name", type: "text" },
      ]),
    },
    {
      name: "Exit Interview",
      department: "HR",
      processingType: defaultProcessingType,
      domainKnowledge: "Standard form to collect feedback during an employee exit interview.",
      structure: transformFields([
        { name: "Employee ID or Email", type: "text" },
        { name: "What is your primary reason for leaving?", type: "text" },
        { name: "Any suggestions for improving the workplace?", type: "textarea" },
      ]),
    },
    {
      name: "Client Visit Summary",
      department: "Sales",
      processingType: defaultProcessingType,
      domainKnowledge: "Captures key points from a client visit to track relationship progress.",
      structure: transformFields([
        { name: "Client Company Name", type: "text" },
        { name: "Date of Visit", type: "date" },
        { name: "Meeting Summary / Notes", type: "textarea" },
      ]),
    },
    {
      name: "Daily Operations Log",
      department: "Operations",
      processingType: defaultProcessingType,
      domainKnowledge: "Log sheet for shift leads to document operational issues and handovers.",
      structure: transformFields([
        { name: "Shift Supervisor Name", type: "text" },
        { name: "Describe any issues encountered during the shift", type: "textarea" },
      ]),
    },
    {
      name: "Delivery Confirmation",
      department: "Logistics",
      processingType: defaultProcessingType,
      domainKnowledge: "Used to confirm the successful delivery of goods and receiver details.",
      structure: transformFields([
        { name: "Delivery ID or Reference Number", type: "text" },
        { name: "Received By (Full Name)", type: "text" },
        { name: "Delivery Date", type: "date" },
      ]),
    },
    {
      name: "Internal Audit Checklist",
      department: "Compliance",
      processingType: defaultProcessingType,
      domainKnowledge: "Comprehensive form used by internal auditors to verify adherence to procedures, safety standards, and quality policies.",
      structure: transformFields([
        { name: "Date of Audit", type: "date" },
        { name: "Name of Auditor", type: "text" },
        { name: "Department Audited", type: "text" },
        { name: "Are safety procedures being followed?", type: "select" },
        { name: "Is all equipment calibrated and certified?", type: "select" },
        { name: "Are employee training records up to date?", type: "select" },
        { name: "Is quality documentation complete and accessible?", type: "select" },
        { name: "Is housekeeping and cleanliness satisfactory?", type: "select" },
        { name: "Are employees using the required PPE?", type: "select" },
        { name: "Were any non-conformities found?", type: "select" },
        { name: "Details of Non-Conformities (if any)", type: "textarea" },
        { name: "Is corrective action needed?", type: "select" },
        { name: "Recommendations or Comments", type: "textarea" },
        { name: "Auditor's Signature or Initials", type: "text" },
      ]),
    },
    {
      name: "Root Cause Analysis (RCA) Report",
      department: "Engineering",
      processingType: defaultProcessingType,
      domainKnowledge: "A formal investigation document used to identify the root cause of a problem, define actions, and prevent recurrence.",
      structure: transformFields([
        { name: "Date of Report", type: "date" },
        { name: "Name of Reporting Person", type: "text" },
        { name: "Title or Summary of Issue", type: "text" },
        { name: "Detailed Problem Description", type: "textarea" },
        { name: "When did the issue occur?", type: "date" },
        { name: "Affected Machine or Production Line", type: "text" },
        { name: "What immediate actions were taken?", type: "textarea" },
        { name: "Describe the containment actions", type: "textarea" },
        { name: "Which analysis method was used?", type: "select" },
        { name: "What was the identified root cause?", type: "textarea" },
        { name: "Describe the corrective action plan", type: "textarea" },
        { name: "Who is responsible for action?", type: "text" },
        { name: "Target Completion Date", type: "date" },
        { name: "How was the solution verified?", type: "textarea" },
        { name: "Final Reviewer Name", type: "text" },
      ]),
    },
  ];

  await FormTemplate.bulkCreate(templates);
  console.log(`✅ Imported ${templates.length} form templates across departments.`);
}
