// src/api/index.ts

// Import individual RPC methods
import { register as userRegister, login as userLogin } from './methods/user';
import { transcribe as audioTranscribe } from './methods/audio';
import { submit as formSubmit } from './methods/form';
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
  // User management methods
  "user.register": userRegister,
  "user.login": userLogin,
  // Audio processing methods
  "audio.transcribe": audioTranscribe,
  // Form processing methods
  "formTemplate.departmentsWithTemplateCount": departmentsWithTemplateCount,
  "formTemplate.get": formTemplateGet,
  "form.submit": formSubmit,
  // AI orchestration methods
  "ai.fillTemplate": aiFillTemplate,
};
