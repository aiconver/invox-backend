import { z } from "zod";

const validRoles = ["operator", "merchandiser"] as const;

export const addUserSchema = z.object({
  username: z.string().min(3),
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.enum(validRoles),
});

export const getUserSchema = z
  .object({
    id: z.string().uuid().optional(),
    email: z.string().email().optional(),
  });

export const updateUserSchema = z.object({
  id: z.string().uuid(),
  username: z.string().min(3).optional(),
  email: z.string().email().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  role: z.enum(validRoles).optional(),
});
