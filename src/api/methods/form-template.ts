// src/api/methods/formTemplate.ts
import {
  assignUsersToTemplate,
  getAssignableUsers as getAssignableUsersHandler,
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
  return await saveFormTemplate(params, context.user)
};

export const getAssignableUsers = async (params: any, context: Context)=> {
  return await getAssignableUsersHandler(params, context.user);
};

export const assignUsers = async (params: any, context: Context) => {
  return await assignUsersToTemplate(params, context.user)
}