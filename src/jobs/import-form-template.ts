import FormTemplate from "@/db/models/formTemplate";

export async function startOneTimeImportFormTemplate() {
  const existing = await FormTemplate.count();
  if (existing > 0) {
    console.log("📦 Form templates already exist. Skipping import.");
    return;
  }

  const templates = [
    {
      name: "Customer Feedback",
      department: "Customer Service",
      structure: {
        fields: [
          { name: "rating", type: "number" },
          { name: "comments", type: "text" },
        ],
      },
    },
    {
      name: "Onboarding Checklist",
      department: "HR",
      structure: {
        fields: [
          { name: "employeeName", type: "text" },
          { name: "startDate", type: "date" },
        ],
      },
    },
  ];

  await FormTemplate.bulkCreate(templates);
  console.log("✅ Imported default form templates.");
}
