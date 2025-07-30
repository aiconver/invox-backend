
import { JwtUser } from "@/types/typed-request";
import { addUser, getUser, updateUser, deleteUser } from "./handlers/user";

type Context = { user: JwtUser };

export const add = async (params: any, context: Context) => {
  return await addUser(params, context.user);
};

export const get = async (params: any, context: Context) => {
  return await getUser(params, context.user);
};

export const update = async (params: any, context: Context) => {
  return await updateUser(params, context.user);
};

export const remove = async (params: any, context: Context) => {
  return await deleteUser(params, context.user);
};
