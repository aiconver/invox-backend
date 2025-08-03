// src/api/index.ts

// Import individual RPC methods
import { add as formCreate, get as formGet, process as formProcess } from './methods/form';
import { fillTemplate as aiFillTemplate } from './methods/fill-template';
import { departmentsWithTemplateCount, get as formTemplateGet, create as formTemplateCreate, update as formTemplateUpdate, remove as formTemplateDelete, getAssignableUsers, assignUsers } from "./methods/form-template";
import {
  add as userAdd,
  get as userGet,
  update as userUpdate,
  remove as userDelete,
} from "./methods/user";

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

  // User CRUD
  "user.add": userAdd,
  "user.get": userGet,
  "user.update": userUpdate,
  "user.delete": userDelete,
  
  // Form Template methods
  "formTemplate.departmentsWithTemplateCount": departmentsWithTemplateCount,
  "formTemplate.get": formTemplateGet,
  "formTemplate.create": formTemplateCreate,
  "formTemplate.update": formTemplateUpdate,
  "formTemplate.delete": formTemplateDelete,
  "formTemplate.getAssignableUsers": getAssignableUsers,
  "formTemplate.assignUsers": assignUsers,
  
  "form.processForm": formProcess,

  // Form methods
  "form.add": formCreate,
  "form.get": formGet,

  // AI orchestration methods
  "ai.fillTemplate": aiFillTemplate,
};
