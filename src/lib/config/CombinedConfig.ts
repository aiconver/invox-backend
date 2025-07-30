import { z } from 'zod';

const envSchema = z
  .object({
    nodeEnv: z.string().default('development'),

    // Main DB
    dbName: z.string(),
    dbUser: z.string(),
    dbPass: z.string(),
    dbHost: z.string(),
    dbPort: z.string().regex(/^\d+$/).transform(Number),

    port: z.string().regex(/^\d+$/).transform(Number).default('3000'),
    logDir: z.string().optional(),

    // Keycloak config
    keycloakServerUrl: z.string().url(),
    keycloakRealm: z.string(),
    keycloakClientId:z.string(),
    keycloakSecret: z.string(),
  })
  .transform((env) => ({
    ...env,
    dbPort: Number(env.dbPort),
    port: Number(env.port),
  }));

export type EnvConfig = z.infer<typeof envSchema>;

export default class CombinedConfig {
  readonly env: EnvConfig;

  constructor(rawEnv: NodeJS.ProcessEnv) {
    const result = envSchema.safeParse({
      nodeEnv: rawEnv.NODE_ENV,

      dbName: rawEnv.DB_NAME,
      dbUser: rawEnv.DB_USER,
      dbPass: rawEnv.DB_PASSWORD,
      dbHost: rawEnv.DB_HOST,
      dbPort: rawEnv.DB_PORT,
      port: rawEnv.PORT,
      logDir: rawEnv.LOG_DIR,

      keycloakServerUrl: rawEnv.KEYCLOAK_SERVER_URL,
      keycloakRealm: rawEnv.KEYCLOAK_REALM,
      keycloakClientId: rawEnv.KEYCLOAK_CLIENT_ID,
      keycloakSecret: rawEnv.KEYCLOAK_SECRET,
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

  get dbHost() {
    return this.env.dbHost;
  }
  get dbUser() {
    return this.env.dbUser;
  }
  get dbPass() {
    return this.env.dbPass;
  }
  get dbName() {
    return this.env.dbName;
  }
  get dbPort() {
    return this.env.dbPort;
  }

  get port() {
    return this.env.port;
  }

  get logDir() {
    return this.env.logDir || './logs/pino.log';
  }

  get isProd() {
    return this.env.nodeEnv === 'production';
  }

  get keycloakServerUrl() {
    return this.env.keycloakServerUrl;
  }
  get keycloakRealm() {
    return this.env.keycloakRealm;
  }
  get keycloakClientId() {
    return this.env.keycloakClientId;
  }
  get keycloakSecret() {
    return this.env.keycloakSecret;
  }
}
