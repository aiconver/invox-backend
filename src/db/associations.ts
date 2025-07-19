import Form from "./models/form";
import FormTemplate from "./models/formTemplate";

FormTemplate.hasMany(Form, { foreignKey: "templateId" });
Form.belongsTo(FormTemplate, { foreignKey: "templateId" });
