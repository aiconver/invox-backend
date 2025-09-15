import { z } from 'zod';

const envSchema = z
  .object({
    nodeEnv: z.string().default('development'),
    port: z
      .string()
      .transform((val) => parseInt(val, 10))
      .default('3001'),

    // Keycloak config
    keycloakClientId: z.string(),
    keycloakServerUrl: z.string().url(),
    keycloakRealm: z.string(),
    keycloakSecret: z.string(),
    keycloakSessionSecret: z.string(),
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
      port: rawEnv.PORT,

      keycloakClientId: rawEnv.KEYCLOAK_CLIENT_ID,
      keycloakServerUrl: rawEnv.KEYCLOAK_SERVER_URL,
      keycloakRealm: rawEnv.KEYCLOAK_REALM,
      keycloakSecret: rawEnv.KEYCLOAK_SECRET,
      keycloakSessionSecret: rawEnv.KEYCLOAK_SESSION_SECRET,
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

  get port() {
    return this.env.port;
  }

  get keycloakClientId() {
    return this.env.keycloakClientId;
  }
  get keycloakServerUrl() {
    return this.env.keycloakServerUrl;
  }
  get keycloakRealm() {
    return this.env.keycloakRealm;
  }
  get keycloakSecret() {
    return this.env.keycloakSecret;
  }
  get keycloakSessionSecret() {
    return this.env.keycloakSessionSecret;
  }

}