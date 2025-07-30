import Form from "./models/form";
import FormTemplate from "./models/formTemplate";
import User from "./models/user";

FormTemplate.hasMany(Form, { foreignKey: "templateId" });
Form.belongsTo(FormTemplate, { foreignKey: "templateId" });

Form.belongsTo(User, { foreignKey: "createdBy", as: "creator" });
User.hasMany(Form, { foreignKey: "createdBy", as: "forms" });