// src/api/methods/form.ts
import { addForm, getForm, updateForm } from "./handlers/form";
import { processForm } from "./handlers/process";
import { JwtUser } from "@/types/typed-request";

type Context = { user: JwtUser };

export const add = async (params: unknown, context: Context) => {
  return await addForm(params, context.user);
};

export const get = async (params: unknown, context: Context) => {
  return await getForm(params, context.user);
};

export const process = async (params: unknown, context: Context) => {
  return await processForm(params, context.user);
};

export const update = async (params: unknown, context: Context) => {
  return await updateForm(params, context.user);
};
