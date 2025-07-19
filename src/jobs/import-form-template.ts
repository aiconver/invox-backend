import FormTemplate from "@/db/models/formTemplate";

export async function startOneTimeImportFormTemplate() {
  const existing = await FormTemplate.count();
  if (existing > 0) {
    console.log("📦 Form templates already exist. Skipping import.");
    return;
  }

  const templates = [
    // 🏢 HR
    {
      name: "Onboarding Checklist",
      department: "HR",
      structure: {
        fields: [
          { name: "employeeName", type: "text" },
          { name: "startDate", type: "date" },
          { name: "manager", type: "text" },
        ],
      },
    },
    {
      name: "Exit Interview",
      department: "HR",
      structure: {
        fields: [
          { name: "employeeId", type: "text" },
          { name: "reasonForLeaving", type: "text" },
          { name: "feedback", type: "textarea" },
        ],
      },
    },

    // 🛍️ Sales
    {
      name: "Client Visit Summary",
      department: "Sales",
      structure: {
        fields: [
          { name: "clientName", type: "text" },
          { name: "visitDate", type: "date" },
          { name: "summary", type: "textarea" },
        ],
      },
    },
    {
      name: "Sales Lead Intake",
      department: "Sales",
      structure: {
        fields: [
          { name: "leadName", type: "text" },
          { name: "company", type: "text" },
          { name: "potentialValue", type: "number" },
        ],
      },
    },
    {
      name: "Monthly Sales Report",
      department: "Sales",
      structure: {
        fields: [
          { name: "month", type: "month" },
          { name: "totalSales", type: "number" },
          { name: "region", type: "text" },
        ],
      },
    },

    // 🛠️ Operations
    {
      name: "Daily Operations Log",
      department: "Operations",
      structure: {
        fields: [
          { name: "shiftLead", type: "text" },
          { name: "issues", type: "textarea" },
        ],
      },
    },
    {
      name: "Equipment Maintenance Record",
      department: "Operations",
      structure: {
        fields: [
          { name: "equipmentId", type: "text" },
          { name: "maintenanceDate", type: "date" },
          { name: "performedBy", type: "text" },
        ],
      },
    },
    {
      name: "Inventory Check",
      department: "Operations",
      structure: {
        fields: [
          { name: "item", type: "text" },
          { name: "quantity", type: "number" },
          { name: "checkedBy", type: "text" },
        ],
      },
    },
    {
      name: "Incident Report",
      department: "Operations",
      structure: {
        fields: [
          { name: "incidentDate", type: "date" },
          { name: "description", type: "textarea" },
          { name: "actionTaken", type: "textarea" },
        ],
      },
    },

    // 📦 Logistics
    {
      name: "Delivery Confirmation",
      department: "Logistics",
      structure: {
        fields: [
          { name: "deliveryId", type: "text" },
          { name: "receivedBy", type: "text" },
          { name: "date", type: "date" },
        ],
      },
    },
    {
      name: "Route Planning Sheet",
      department: "Logistics",
      structure: {
        fields: [
          { name: "driver", type: "text" },
          { name: "route", type: "text" },
          { name: "departureTime", type: "time" },
        ],
      },
    },
    {
      name: "Logistics Daily Summary",
      department: "Logistics",
      structure: {
        fields: [
          { name: "supervisor", type: "text" },
          { name: "notes", type: "textarea" },
        ],
      },
    },
    {
      name: "Vehicle Inspection Checklist",
      department: "Logistics",
      structure: {
        fields: [
          { name: "vehicleId", type: "text" },
          { name: "inspectionDate", type: "date" },
          { name: "status", type: "text" },
        ],
      },
    },

    // 🎧 Customer Service
    {
      name: "Customer Feedback",
      department: "Customer Service",
      structure: {
        fields: [
          { name: "rating", type: "number" },
          { name: "comments", type: "textarea" },
        ],
      },
    },
    {
      name: "Issue Ticket",
      department: "Customer Service",
      structure: {
        fields: [
          { name: "ticketId", type: "text" },
          { name: "issue", type: "textarea" },
          { name: "priority", type: "text" },
        ],
      },
    },
    {
      name: "Support Call Summary",
      department: "Customer Service",
      structure: {
        fields: [
          { name: "callerName", type: "text" },
          { name: "callDuration", type: "number" },
          { name: "resolution", type: "textarea" },
        ],
      },
    },
    {
      name: "Service Recovery Report",
      department: "Customer Service",
      structure: {
        fields: [
          { name: "incident", type: "text" },
          { name: "apologySent", type: "boolean" },
          { name: "resolutionSteps", type: "textarea" },
        ],
      },
    },
  ];

  await FormTemplate.bulkCreate(templates);
  console.log(`✅ Imported ${templates.length} default form Templates across 5 departments.`);
}
