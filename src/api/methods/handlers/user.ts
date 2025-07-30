import User from "@/db/models/user";
import { JwtUser } from "@/types/typed-request";
import {
  addUserSchema,
  getUserSchema,
  updateUserSchema,
} from "../schemas/user";

export async function addUser(params: unknown, _user: JwtUser) {
  const { username, email, firstName, lastName, role } = addUserSchema.parse(params);

  const existing = await User.findOne({ where: { email } });
  if (existing) {
    throw new Error(`User with email "${email}" already exists`);
  }

  const user = await User.create({ username, email, firstName, lastName, role });
  return { message: "User created", id: user.id };
}

export async function getUser(params: unknown, _user: JwtUser) {
  const parsed = getUserSchema.parse(params);

  if (parsed.id) {
    const user = await User.findByPk(parsed.id);
    if (!user) throw new Error(`User with id "${parsed.id}" not found`);
    return user;
  }

  if (parsed.email) {
    const user = await User.findOne({ where: { email: parsed.email } });
    if (!user) throw new Error(`User with email "${parsed.email}" not found`);
    return user;
  }

  return await User.findAll({ order: [["createdAt", "DESC"]] });
}

export async function updateUser(params: unknown, _user: JwtUser) {
  const parsed = updateUserSchema.parse(params);
  const { id, ...updates } = parsed;

  const user = await User.findByPk(id);
  if (!user) throw new Error(`User with id "${id}" not found`);

  await user.update(updates);
  return { message: "User updated" };
}

export async function deleteUser(params: unknown, _user: JwtUser) {
  const { id } = getUserSchema.parse(params); // `id` is validated by schema

  const user = await User.findByPk(id);
  if (!user) throw new Error(`User with id "${id}" not found`);

  await user.destroy();
  return { message: "User deleted" };
}
