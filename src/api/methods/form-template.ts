// src/api/methods/formTemplate.ts
import { getDepartmentsWithTemplateCount, getFormTemplate } from "./handlers/form-template";

export const departmentsWithTemplateCount = async () => {
  return await getDepartmentsWithTemplateCount();
};

export const get = async (params: any) => {
  return await getFormTemplate(params);
};
