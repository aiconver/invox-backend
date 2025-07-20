import { addForm, getForm } from "./handlers/form";
import { processForm } from "./handlers/process";

export const add = async (params: unknown) => {
  return await addForm(params);
};

export const get = async (params: unknown) => {
  return await getForm(params);
};

export const process = async (params: unknown) => {
  return await processForm(params);
};
