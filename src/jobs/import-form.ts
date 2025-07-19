import Form from "@/db/models/form";
import FormTemplate from "@/db/models/formTemplate";

export async function startOneTimeImportForm() {
  const count = await Form.count();
  if (count > 0) {
    console.log("📄 Forms already exist. Skipping import.");
    return;
  }

  const template = await FormTemplate.findOne({
    where: { name: "Customer Feedback" },
  });

  if (!template) {
    console.warn("⚠️ No form template found. Skipping form import.");
    return;
  }

  await Form.create({
    templateId: template.id,
    values: {
      rating: 5,
      comments: "Great service!",
    },
  });

  console.log("✅ Imported one sample form.");
}
