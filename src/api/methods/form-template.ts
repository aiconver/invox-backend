// src/api/methods/formTemplate.ts
import { getDepartmentsWithTemplateCount, getFormTemplate, saveFormTemplate } from "./handlers/form-template";

/**
 * Method to get the department count along with associated templates.
 * @returns {Promise} The department count with template info.
 */
export const departmentsWithTemplateCount = async () => {
  return await getDepartmentsWithTemplateCount();
};

/**
 * Method to get form templates based on parameters (ID or department).
 * @param {any} params - The parameters for fetching form templates.
 * @returns {Promise} A list of form templates.
 */
export const get = async (params: any) => {
  return await getFormTemplate(params);
};

/**
 * Method to create a new form template.
 * @param {any} params - The template data to save.
 * @returns {Promise} The saved form template.
 */
export const create = async (params: any) => {
  return await saveFormTemplate(params);
};
