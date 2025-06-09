
import { z } from "zod";
import dotenv from "dotenv";
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.string().optional(),
  PORT: z.string().default("3000"),
  DATABASE_URL: z.string().url(),
  WHISPER_URL: z.string().url(),
  JWT_SECRET: z.string()
});

export const config = envSchema.parse(process.env);
