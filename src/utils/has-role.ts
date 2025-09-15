import { AppRoles } from "@/types/app-roles";
import { JwtUser } from "@/types/typed-request";

// Accept either JwtUser or DB User model
export function hasRole(
  user: JwtUser | undefined,
  role: AppRoles
): boolean {
  if (!user) return false;

  // Case 1: JWT user (from token)
  if ("realm_access" in user) {
    return user.realm_access?.roles?.includes(role) ?? false;
  }

  // Case 1: JWT user (from token), but with extended token info
  if ("token" in user && "realm_access" in user.token?.content) {
    return user.token?.content.realm_access?.roles?.includes(role) ?? false;
  }

  // Case 2: Sequelize User instance from DB
  if ("role" in user) {
    return user.role === role;
  }

  return false;
}
