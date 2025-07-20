// src/api/index.ts

// Import individual RPC methods
import { processForm as processForm } from './methods/process-form';
import { add as formCreate, get as formGet } from './methods/form';
import { fillTemplate as aiFillTemplate } from './methods/fill-template';
import { departmentsWithTemplateCount, get as formTemplateGet } from "./methods/form-template";

/**
 * Collection of all JSON-RPC methods available in the API.
 */
export const rpcMethods = {
  /**
   * Health check method.
   * @returns {string} "pong"
   */
  "ping": () => {
    return "pong";
  },
  
  // Form processing methods
  "formTemplate.departmentsWithTemplateCount": departmentsWithTemplateCount,
  "formTemplate.get": formTemplateGet,
  "form.processForm": processForm,
  "form.add": formCreate,
  "form.get": formGet,


  // AI orchestration methods
  "ai.fillTemplate": aiFillTemplate,
};
