// src/types/typed-request.ts
export interface JwtUser {
  sub: string;
  email: string;
  preferred_username: string;
  realm_access?: {
    roles: string[];
  };
  [key: string]: any;
}
