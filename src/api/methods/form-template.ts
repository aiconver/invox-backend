// src/api/methods/formTemplate.ts
import {
  getDepartmentsWithTemplateCount,
  getFormTemplate,
  saveFormTemplate,
} from "./handlers/form-template";
import { JwtUser } from "@/types/typed-request";

type Context = { user: JwtUser };

export const departmentsWithTemplateCount = async (_params: any, context: Context) => {
  return await getDepartmentsWithTemplateCount(context.user);
};

export const get = async (params: any, context: Context) => {
  return await getFormTemplate(params, context.user);
};

export const create = async (params: any, context: Context) => {
  return await saveFormTemplate(params, context.user);
};
