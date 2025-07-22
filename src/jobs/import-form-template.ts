import { ProcessingType } from "@/db/models/enums";
import FormTemplate from "@/db/models/formTemplate";

// Transform array of fields into object: { fieldName: { type, required } }
function transformFields(fields: { name: string; type: string }[]) {
  const structure: Record<string, { type: string; required: boolean }> = {};
  for (const field of fields) {
    structure[field.name] = {
      type: field.type,
      required: true,
    };
  }
  return structure;
}

export async function startOneTimeImportFormTemplate() {
  const existing = await FormTemplate.count();
  if (existing > 0) {
    console.log("📦 Form templates already exist. Skipping import.");
    return;
  }

  const defaultProcessingType = ProcessingType.OneModelAllQuestion;

  const templates = [
    {
      name: "Onboarding Checklist",
      department: "HR",
      processingType: defaultProcessingType,
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
      structure: transformFields([
        { name: "clientName", type: "text" },
        { name: "visitDate", type: "date" },
        { name: "summary", type: "textarea" },
      ]),
    },
    {
      name: "Sales Lead Intake",
      department: "Sales",
      processingType: defaultProcessingType,
      structure: transformFields([
        { name: "leadName", type: "text" },
        { name: "company", type: "text" },
        { name: "potentialValue", type: "number" },
      ]),
    },
    {
      name: "Monthly Sales Report",
      department: "Sales",
      processingType: defaultProcessingType,
      structure: transformFields([
        { name: "month", type: "month" },
        { name: "totalSales", type: "number" },
        { name: "region", type: "text" },
      ]),
    },
    {
      name: "Daily Operations Log",
      department: "Operations",
      processingType: defaultProcessingType,
      structure: transformFields([
        { name: "shiftLead", type: "text" },
        { name: "issues", type: "textarea" },
      ]),
    },
    {
      name: "Equipment Maintenance Record",
      department: "Operations",
      processingType: defaultProcessingType,
      structure: transformFields([
        { name: "equipmentId", type: "text" },
        { name: "maintenanceDate", type: "date" },
        { name: "performedBy", type: "text" },
      ]),
    },
    {
      name: "Inventory Check",
      department: "Operations",
      processingType: defaultProcessingType,
      structure: transformFields([
        { name: "item", type: "text" },
        { name: "quantity", type: "number" },
        { name: "checkedBy", type: "text" },
      ]),
    },
    {
      name: "Incident Report",
      department: "Operations",
      processingType: defaultProcessingType,
      structure: transformFields([
        { name: "incidentDate", type: "date" },
        { name: "description", type: "textarea" },
        { name: "actionTaken", type: "textarea" },
      ]),
    },
    {
      name: "Delivery Confirmation",
      department: "Logistics",
      processingType: defaultProcessingType,
      structure: transformFields([
        { name: "deliveryId", type: "text" },
        { name: "receivedBy", type: "text" },
        { name: "date", type: "date" },
      ]),
    },
    {
      name: "Route Planning Sheet",
      department: "Logistics",
      processingType: defaultProcessingType,
      structure: transformFields([
        { name: "driver", type: "text" },
        { name: "route", type: "text" },
        { name: "departureTime", type: "time" },
      ]),
    },
    {
      name: "Logistics Daily Summary",
      department: "Logistics",
      processingType: defaultProcessingType,
      structure: transformFields([
        { name: "supervisor", type: "text" },
        { name: "notes", type: "textarea" },
      ]),
    },
    {
      name: "Vehicle Inspection Checklist",
      department: "Logistics",
      processingType: defaultProcessingType,
      structure: transformFields([
        { name: "vehicleId", type: "text" },
        { name: "inspectionDate", type: "date" },
        { name: "status", type: "text" },
      ]),
    },
    {
      name: "Customer Feedback",
      department: "Customer Service",
      processingType: defaultProcessingType,
      structure: transformFields([
        { name: "rating", type: "number" },
        { name: "comments", type: "textarea" },
      ]),
    },
    {
      name: "Issue Ticket",
      department: "Customer Service",
      processingType: defaultProcessingType,
      structure: transformFields([
        { name: "ticketId", type: "text" },
        { name: "issue", type: "textarea" },
        { name: "priority", type: "text" },
      ]),
    },
    {
      name: "Support Call Summary",
      department: "Customer Service",
      processingType: defaultProcessingType,
      structure: transformFields([
        { name: "callerName", type: "text" },
        { name: "callDuration", type: "number" },
        { name: "resolution", type: "textarea" },
      ]),
    },
    {
      name: "Service Recovery Report",
      department: "Customer Service",
      processingType: defaultProcessingType,
      structure: transformFields([
        { name: "incident", type: "text" },
        { name: "apologySent", type: "boolean" },
        { name: "resolutionSteps", type: "textarea" },
      ]),
    },
  ];

  await FormTemplate.bulkCreate(templates);
  console.log(`✅ Imported ${templates.length} default form Templates across 5 departments.`);
}
