import { z } from 'zod';

const envSchema = z
  .object({
    nodeEnv: z.string().default('development'),
  })
  .transform((env) => ({
    ...env,
  }));

export type EnvConfig = z.infer<typeof envSchema>;

export default class CombinedConfig {
  readonly env: EnvConfig;

  constructor(rawEnv: NodeJS.ProcessEnv) {
    const result = envSchema.safeParse({
      nodeEnv: rawEnv.NODE_ENV,
    });

    if (!result.success) {
      console.error('❌ Invalid environment variables:');
      console.error(result.error.format());
      throw new Error('Invalid .env configuration');
    }

    this.env = result.data;
  }

  get nodeEnv() {
    return this.env.nodeEnv;
  }

}