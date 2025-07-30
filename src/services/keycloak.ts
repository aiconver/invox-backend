import CombinedConfig from "@/lib/config/CombinedConfig";
import KcAdminClient from "@keycloak/keycloak-admin-client";
import UserRepresentation from "@keycloak/keycloak-admin-client/lib/defs/userRepresentation";

const config = new CombinedConfig(process.env);

function sanitizeName(input: string): string {
  return input
    .normalize("NFD")                 // Normalize Unicode (e.g. "Ö" → "Ö")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[^a-zA-Z0-9\s\-']/g, "") // Keep letters, digits, spaces, dashes, apostrophes
    .trim();
}

type KeycloakUserInput = {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  password?: string;
};

class KeycloakService {
  private kcAdminClient: KcAdminClient;
  private initialized: boolean;

  constructor() {
    this.kcAdminClient = new KcAdminClient({
      baseUrl: config.keycloakServerUrl,
      realmName: config.env.keycloakRealm,
    });
    this.initialized = false;
  }

  private lastAuthTime: number = 0;
  private tokenTTL: number = 60; // seconds, adjust based on your Keycloak config

  private async init() {
    const now = Date.now() / 1000;
    const tokenIsExpired = now - this.lastAuthTime > this.tokenTTL;

    if (!this.initialized || tokenIsExpired) {
      const clientId = config.keycloakClientId;
      const clientSecret = config.keycloakSecret;

      await this.kcAdminClient.auth({
        grantType: "client_credentials",
        clientId,
        clientSecret,
      });

      this.lastAuthTime = now;
      this.initialized = true;
    }
  }

    async createUser({
    username,
    email,
    firstName,
    lastName,
    password,
  }: KeycloakUserInput): Promise<{ id: string }> {
    try {

    await this.init();

    const cleanFirstName = sanitizeName(firstName);
    const cleanLastName = sanitizeName(lastName);



    // Try to find user by username
    const usersByUsername = await this.kcAdminClient.users.find({ username });

    if (usersByUsername.length > 0) {
      console.log(`🔁 Keycloak user already exists: ${username}`);
      if (!usersByUsername[0].id) {
        throw Error(`User with username ${username} has no ID!`);
      }
      return { id: usersByUsername[0].id };
    }

    // If no user found by username, check email
    const usersByEmail = await this.kcAdminClient.users.find({ email });
    if (usersByEmail.length > 0) {
      console.warn(`⚠️ Email "${email}" already in use or user has no ID, skipping creation of user "${username}"`);
      if (!usersByEmail[0].id) {
        throw Error(`User with email ${email} has no ID!`);
      }
      return { id: usersByEmail[0].id };
    }

    const userData: UserRepresentation = {
      username,
      email,
      enabled: true,
      firstName: cleanFirstName,
      lastName: cleanLastName,
    };

    if (password) {
            userData.credentials = [
        {
          type: "password",
          value: password,
          temporary: true,
        },
      ];
    }

    // Create new user
    const result = await this.kcAdminClient.users.create(userData);
    console.log(`🆕 Keycloak user created: ${username}`);
    return result;
  } catch (err) {
    throw Error(`Failed creating Keycloak user: ${err}, ${JSON.stringify({
    username,
    email,
    firstName,
    lastName,
    password,
  })}`);
  }
  }


  async createOrUpdateUser({
    username,
    email,
    firstName,
    lastName,
    password,
  }: KeycloakUserInput): Promise<{ id: string }> {
    await this.init();

    const cleanFirstName = sanitizeName(firstName);
    const cleanLastName = sanitizeName(lastName);

    // Try to find user by username
    const usersByUsername = await this.kcAdminClient.users.find({ email });

    if (usersByUsername.length > 0) {
      const kcUser = usersByUsername[0];

      // Check for email conflict (same email, different user)
      if (kcUser.email !== email) {
        const usersByEmail = await this.kcAdminClient.users.find({ email });
        if (usersByEmail.length > 0 && usersByEmail[0].id !== kcUser.id) {
          throw Error(`⚠️ Email "${email}" already in use by another user, skipping update for ${username}`);
        }
      }

      if (!kcUser.id) {
        throw Error(`⚠️ User with email "${email}" has no ID, skipping update for ${username}`);
      }

      // Update existing user
      await this.kcAdminClient.users.update(
        { id: kcUser.id },
        {
          email,
          firstName: cleanFirstName,
          lastName: cleanLastName,
          enabled: true,
        }
      );
      console.log(`🔁 Keycloak user updated: ${username}`);
      return { id: kcUser.id };
    }

    // If no user found by username, check email
    const usersByEmail = await this.kcAdminClient.users.find({ email });
    if (usersByEmail.length > 0) {
      console.warn(`⚠️ Email "${email}" already in use or user has no ID, skipping creation of user "${username}"`);
      if (!usersByEmail[0].id) {
        throw Error(`User with email ${email} has no ID!`);
      }
      return { id: usersByEmail[0].id };
    }

    const userData: UserRepresentation = {
      username,
      email,
      enabled: true,
      firstName: cleanFirstName,
      lastName: cleanLastName,
    };

    if (password) {
            userData.credentials = [
        {
          type: "password",
          value: password,
          temporary: true,
        },
      ];
    }

    // Create new user
    const result = await this.kcAdminClient.users.create(userData);
    console.log(`🆕 Keycloak user created: ${username}`);
    return result;
  }

  async updateUser(id: string, updates: Partial<KeycloakUserInput>): Promise<void> {
    await this.init();

    const existingUser = await this.kcAdminClient.users.findOne({ id });
    if (!existingUser) {
      throw new Error(`User with ID ${id} not found in Keycloak`);
    }

    const updatePayload: Partial<UserRepresentation> = {};

    if (updates.username !== undefined) updatePayload.username = updates.username;
    if (updates.email !== undefined) updatePayload.email = updates.email;
    if (updates.firstName !== undefined) updatePayload.firstName = sanitizeName(updates.firstName);
    if (updates.lastName !== undefined) updatePayload.lastName = sanitizeName(updates.lastName);

    await this.kcAdminClient.users.update({ id }, updatePayload);

    console.log(`✏️ Updated Keycloak user ${existingUser.username} (${id})`);
  }

  async assignRealmRole(username: string, roleName: string): Promise<void> {
    await this.init();

    const users = await this.kcAdminClient.users.find({ username });
    if (!users.length) {
      console.warn(`⚠️ Cannot assign role, user not found: ${username}`);
      return;
    }

    const kcUser = users[0];
    const role = await this.kcAdminClient.roles.findOneByName({ name: roleName });

    if (!role) {
      console.warn(`⚠️ Role '${roleName}' not found in Keycloak`);
      return;
    }

    await this.kcAdminClient.users.addRealmRoleMappings({
      id: kcUser.id!,
      roles: [{ id: role.id!, name: role.name! }],
    });

    console.log(`✅ Assigned Keycloak role '${roleName}' to ${username}`);
  }
}

export default new KeycloakService();
