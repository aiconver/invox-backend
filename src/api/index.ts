// src/api/index.ts

// Import individual RPC methods
import { add as formCreate, get as formGet, process as formProcess } from './methods/form';
import { fillTemplate as aiFillTemplate } from './methods/fill-template';
import { departmentsWithTemplateCount, get as formTemplateGet, create as formTemplateCreate } from "./methods/form-template";

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
  
  // Form Template methods
  "formTemplate.departmentsWithTemplateCount": departmentsWithTemplateCount,
  "formTemplate.get": formTemplateGet,
  "formTemplate.create": formTemplateCreate,
  
  "form.processForm": formProcess,

  // Form methods
  "form.add": formCreate,
  "form.get": formGet,

  // AI orchestration methods
  "ai.fillTemplate": aiFillTemplate,
};
