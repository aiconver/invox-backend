// src/api/methods/formTemplate.ts
import {
  assignUsersToTemplate,
  createFormTemplate,
  getAssignableUsers as getAssignableUsersHandler,
  getDepartmentsWithTemplateCount,
  getFormTemplate,
  updateFormTemplate,
  deleteFormTemplate
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
  return await createFormTemplate(params, context.user)
}

export const update = async (params: any, context: Context) => {
  return await updateFormTemplate(params, context.user)
}

export const remove = async (params:any, context: Context) => {
  return await deleteFormTemplate(params, context.user)
}

export const getAssignableUsers = async (params: any, context: Context)=> {
  return await getAssignableUsersHandler(params, context.user);
};

export const assignUsers = async (params: any, context: Context) => {
  return await assignUsersToTemplate(params, context.user)
}